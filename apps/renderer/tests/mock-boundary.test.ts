import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { relative, resolve } from 'node:path'

const repoRoot = resolve(__dirname, '..', '..', '..')
const rendererSrc = resolve(repoRoot, 'apps', 'renderer', 'src')
const allowDir = resolve(rendererSrc, 'dev')
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx'])

const forbiddenPatterns: Array<{ name: string; pattern: RegExp }> = [
  { name: 'dev mock import', pattern: /@\/dev\/__mocks__/ },
  { name: 'mockStatus', pattern: /\bmockStatus\b/ },
  { name: 'mockBanners', pattern: /\bmockBanners\b/ },
  { name: 'mockToasts', pattern: /\bmockToasts\b/ },
  { name: 'mockSafeStorage', pattern: /\bmockSafeStorage\b/ },
  { name: 'SCRIPTED_CONVO', pattern: /\bSCRIPTED_CONVO\b/ },
  { name: 'PLACEHOLDER_THREADS', pattern: /\bPLACEHOLDER_THREADS\b/ },
  { name: 'startSidecarLogs', pattern: /\bstartSidecarLogs\b/ },
  { name: 'mock alert', pattern: /alert\('\(mock\)/ },
  { name: 'mock would-open copy', pattern: /Would open/ }
]

function isSourceFile(filePath: string): boolean {
  return sourceExtensions.has(filePath.slice(filePath.lastIndexOf('.')))
}

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const fullPath = resolve(dir, entry)
    if (fullPath.startsWith(allowDir)) continue
    const stat = statSync(fullPath)
    if (stat.isDirectory()) out.push(...walk(fullPath))
    else if (stat.isFile() && isSourceFile(fullPath)) out.push(fullPath)
  }
  return out
}

describe('production mock boundary', () => {
  it('keeps dev mocks and mock-only actions out of production renderer source', () => {
    const violations: string[] = []
    for (const filePath of walk(rendererSrc)) {
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
