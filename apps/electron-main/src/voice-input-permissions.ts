import type { Session, WebContents } from 'electron'

type PermissionDetails = {
  requestingUrl?: string
  securityOrigin?: string
  mediaType?: string
  mediaTypes?: string[]
}

export type VoiceInputPermissionDecisionInput = {
  permission: string
  requestingOrigin?: string
  webContentsUrl?: string
  details?: PermissionDetails
}

function originOf(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const parsed = new URL(value)
    if (parsed.protocol === 'file:') return 'file://'
    return parsed.origin
  } catch {
    return null
  }
}

function requestedMediaTypes(details: PermissionDetails | undefined): string[] {
  if (Array.isArray(details?.mediaTypes)) return details.mediaTypes
  if (details?.mediaType) return [details.mediaType]
  return []
}

export function isVoiceInputPermissionAllowed(
  input: VoiceInputPermissionDecisionInput,
  allowedOrigins: readonly string[]
): boolean {
  if (input.permission !== 'media') return false
  const mediaTypes = requestedMediaTypes(input.details)
  if (mediaTypes.length > 0 && !mediaTypes.includes('audio')) return false
  if (mediaTypes.includes('video')) return false

  const candidateOrigins = [
    originOf(input.details?.requestingUrl),
    originOf(input.details?.securityOrigin),
    originOf(input.requestingOrigin),
    originOf(input.webContentsUrl)
  ].filter((origin): origin is string => origin !== null)

  return candidateOrigins.some((origin) => allowedOrigins.includes(origin))
}

export function configureVoiceInputPermissionHandlers(
  session: Session,
  allowedOrigins: readonly string[]
): () => void {
  session.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const allowed = isVoiceInputPermissionAllowed(
      {
        permission,
        webContentsUrl: webContents.getURL(),
        details: details as PermissionDetails | undefined
      },
      allowedOrigins
    )
    callback(allowed)
  })
  session.setPermissionCheckHandler((webContents: WebContents | null, permission, requestingOrigin, details) =>
    isVoiceInputPermissionAllowed(
      {
        permission,
        requestingOrigin,
        webContentsUrl: webContents?.getURL(),
        details: details as PermissionDetails | undefined
      },
      allowedOrigins
    )
  )
  return () => {
    session.setPermissionRequestHandler(null)
    session.setPermissionCheckHandler(null)
  }
}

export function rendererAllowedOrigins(rendererUrl: string | undefined): string[] {
  const devOrigin = originOf(rendererUrl)
  return devOrigin ? [devOrigin] : ['file://']
}
