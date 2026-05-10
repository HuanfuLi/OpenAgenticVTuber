import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { ReferenceAudioAsset, VoicePreset } from '../../../packages/contracts/ts/voice-preset'
import { canDeleteReferenceAudio } from './safe-storage'

export interface ReferenceAudioValidationInput {
  assetId: string
  displayBasename: string
  transcriptText: string
  language: ReferenceAudioAsset['language']
}

export interface ManagedReferenceAudioValidationInput {
  managedPath: string
  displayBasename: string
  transcriptText: string
  language: ReferenceAudioAsset['language']
}

export interface ReferenceAudioValidationError {
  code: string
  message: string
}

export interface ReferenceAudioValidationResponse {
  ok: boolean
  format: ReferenceAudioAsset['format'] | null
  duration_seconds: number | null
  sample_rate: number | null
  channels: number | null
  errors: ReferenceAudioValidationError[]
  redacted_diagnostics: string
}

export interface PickAndImportReferenceAudioInput {
  sourcePath: string
  transcriptText: string
  language: ReferenceAudioAsset['language']
  assetId?: string
  validate: (input: ManagedReferenceAudioValidationInput) => Promise<ReferenceAudioValidationResponse>
}

export type DeleteReferenceAudioAssetResult =
  | { ok: true; removedAssets: ReferenceAudioAsset[] }
  | { ok: false; reason: 'reference_audio_in_use'; presetIds: string[] }

const SUPPORTED_REFERENCE_AUDIO_FORMATS = new Set(['wav', 'flac', 'mp3', 'ogg'])

export function referenceAudioDirectory(): string {
  return path.join(app.getPath('userData'), 'reference-audio')
}

export function getManagedReferenceAudioPath(asset: ReferenceAudioAsset): string {
  const managedPath = path.resolve(app.getPath('userData'), asset.managed_path_token)
  assertManagedReferenceAudioPath(managedPath)
  return managedPath
}

export function assertManagedReferenceAudioPath(candidatePath: string): string {
  const root = path.resolve(referenceAudioDirectory())
  const resolved = path.resolve(candidatePath)
  const relative = path.relative(root, resolved)
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Invalid managed reference audio path.')
  }
  return resolved
}

export function resolveReferenceAudioAssetPath(assetId: string, assets: ReferenceAudioAsset[]): { asset: ReferenceAudioAsset; managedPath: string } {
  const asset = assets.find((item) => item.asset_id === assetId)
  if (!asset) throw new Error('Unknown reference audio asset.')
  return { asset, managedPath: getManagedReferenceAudioPath(asset) }
}

function sanitizeBasename(originalBasename: string): string {
  const parsed = path.parse(originalBasename)
  const safeName = parsed.name
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
  const safeExt = parsed.ext.toLowerCase().replace(/[^.a-z0-9]/g, '')
  return `${safeName || 'reference-audio'}${safeExt}`
}

export async function validateReferenceAudioWithSidecar(
  baseUrl: string,
  input: ManagedReferenceAudioValidationInput,
  fetchImpl: typeof fetch = fetch
): Promise<ReferenceAudioValidationResponse> {
  const resp = await fetchImpl(`${baseUrl}/admin/audio/reference-audio/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      managed_path: input.managedPath,
      display_basename: input.displayBasename,
      transcript_text: input.transcriptText,
      language: input.language
    })
  })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Reference audio validation failed: HTTP ${resp.status} - ${text}`)
  }
  return (await resp.json()) as ReferenceAudioValidationResponse
}

export async function pickAndImportReferenceAudio(
  input: PickAndImportReferenceAudioInput
): Promise<ReferenceAudioAsset> {
  const originalBasename = path.basename(input.sourcePath)
  const extension = path.extname(originalBasename).toLowerCase().slice(1)
  if (!SUPPORTED_REFERENCE_AUDIO_FORMATS.has(extension)) {
    throw new Error('Reference audio format must be one of: wav, flac, mp3, ogg.')
  }
  const assetId = input.assetId ?? `ref-${randomUUID()}`
  const managedBasename = `${assetId}-${sanitizeBasename(originalBasename)}`
  const storageDir = referenceAudioDirectory()
  fs.mkdirSync(storageDir, { recursive: true })
  const managedPath = path.join(storageDir, managedBasename)
  fs.copyFileSync(input.sourcePath, managedPath)

  const validation = await input.validate({
    managedPath: assertManagedReferenceAudioPath(managedPath),
    displayBasename: originalBasename,
    transcriptText: input.transcriptText,
    language: input.language
  })
  if (!validation.ok) {
    if (fs.existsSync(managedPath)) fs.unlinkSync(managedPath)
    const firstError = validation.errors[0]
    throw new Error(firstError?.message ?? 'Reference audio validation failed.')
  }

  return {
    asset_id: assetId,
    display_basename: originalBasename,
    managed_path_token: path.join('reference-audio', managedBasename),
    transcript_text: input.transcriptText,
    language: input.language,
    format: validation.format ?? (extension as ReferenceAudioAsset['format']),
    duration_ms: Math.round((validation.duration_seconds ?? 0) * 1000)
  }
}

export function deleteReferenceAudioAsset(
  assetId: string,
  voicePresets: VoicePreset[],
  referenceAudioAssets: ReferenceAudioAsset[]
): DeleteReferenceAudioAssetResult {
  const guard = canDeleteReferenceAudio(assetId, voicePresets)
  if (!guard.ok) {
    return { ok: false, reason: guard.reason, presetIds: guard.presetIds }
  }
  return {
    ok: true,
    removedAssets: referenceAudioAssets.filter((asset) => asset.asset_id === assetId)
  }
}
