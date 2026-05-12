import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { relative, resolve } from 'node:path'

const repoRoot = resolve(__dirname, '..', '..', '..')
const rendererSrc = resolve(repoRoot, 'apps', 'renderer', 'src')
const rendererDevDir = resolve(rendererSrc, 'dev')
const productionRoots = [
  rendererSrc,
  resolve(repoRoot, 'apps', 'electron-main', 'src'),
  resolve(repoRoot, 'sidecar', 'src', 'sidecar')
]
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.py'])

const forbiddenPatterns: Array<{ name: string; pattern: RegExp }> = [
  { name: 'dev mock import', pattern: /@\/dev\/__mocks__/ },
  { name: 'mockStatus', pattern: /\bmockStatus\b/ },
  { name: 'mockBanners', pattern: /\bmockBanners\b/ },
  { name: 'mockToasts', pattern: /\bmockToasts\b/ },
  { name: 'mockSafeStorage', pattern: /\bmockSafeStorage\b/ },
  { name: 'SCRIPTED_CONVO', pattern: /\bSCRIPTED_CONVO\b/ },
  { name: 'PLACEHOLDER_THREADS', pattern: /\bPLACEHOLDER_THREADS\b/ },
  { name: 'startSidecarLogs', pattern: /\bstartSidecarLogs\b/ },
  { name: 'window.MOCK', pattern: /\bwindow\.MOCK\b/ },
  { name: 'mock alert', pattern: /alert\('\(mock\)/ },
  { name: 'mock would-open copy', pattern: /Would open/ },
  { name: 'legacy STUB-TTS marker', pattern: /\[STUB-TTS\]/ },
  { name: 'legacy phase stub path', pattern: /Phase 2 stub path/ }
]

function isSourceFile(filePath: string): boolean {
  return sourceExtensions.has(filePath.slice(filePath.lastIndexOf('.')))
}

function walk(dir: string): string[] {
  const out: string[] = []
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir)) {
    const fullPath = resolve(dir, entry)
    if (fullPath.startsWith(rendererDevDir)) continue
    const stat = statSync(fullPath)
    if (stat.isDirectory()) out.push(...walk(fullPath))
    else if (stat.isFile() && isSourceFile(fullPath)) out.push(fullPath)
  }
  return out
}

describe('production mock boundary', () => {
  it('keeps the archived browser prototype out of production entrypoints', () => {
    expect(existsSync(resolve(repoRoot, 'index.html'))).toBe(false)
    expect(existsSync(resolve(repoRoot, 'src'))).toBe(false)
  })

  it('keeps dev mocks and mock-only actions out of production source', () => {
    const violations: string[] = []
    for (const filePath of productionRoots.flatMap(walk)) {
      const text = readFileSync(filePath, 'utf8')
      for (const check of forbiddenPatterns) {
        if (check.pattern.test(text)) {
          violations.push(`${relative(repoRoot, filePath)}: ${check.name}`)
        }
      }
    }

    expect(violations).toEqual([])
  })
})
