import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import type { AvatarImportPlan } from '@contracts/avatar-import-plan'
import type { VariantEntry } from '@contracts/variant-entry'
import { AppStoreProvider } from '@/state/app-store'
import { AvatarImport } from '@/screens/AvatarImport/AvatarImport'
import { usePlaceholderGate } from '@/screens/AvatarImport/usePlaceholderGate'

const hotkeyId = '1234567890abcdef1234567890abcdef'

function mockPlan(
  variants: VariantEntry[],
  detectedType = 'vts_standard'
): AvatarImportPlan {
  return {
    detected_type: detectedType,
    avatar_id: 'teto',
    avatar_name: 'Teto',
    source_rig_path: 'Live2D/teto',
    variants,
    events: [],
    default_plugin_action_bindings: [],
    voice: null,
    warnings: [],
    existing_overrides: null
  }
}

function renderImport(plan: AvatarImportPlan) {
  return render(
    <AppStoreProvider>
      <AvatarImport _testInitialPlan={plan} />
    </AppStoreProvider>
  )
}

describe('usePlaceholderGate', () => {
  it('allows save when there are no placeholder variant codes', () => {
    const result = usePlaceholderGate([
      { code: 'joy', hotkey_id: hotkeyId, source_name: 'Joy', is_placeholder: false },
      { code: 'surprise', hotkey_id: hotkeyId, source_name: 'Surprise', is_placeholder: false },
      { code: 'wave', hotkey_id: hotkeyId, source_name: 'Wave', is_placeholder: false }
    ])

    expect(result.isDisabled).toBe(false)
    expect(result.placeholderCount).toBe(0)
    expect(result.firstPlaceholderIndex).toBe(-1)
  })

  it('disables save when one placeholder remains', () => {
    const result = usePlaceholderGate([
      { code: 'joy', hotkey_id: hotkeyId, source_name: 'Joy', is_placeholder: false },
      { code: 'exp_01', hotkey_id: hotkeyId, source_name: 'exp_01', is_placeholder: true }
    ])

    expect(result.isDisabled).toBe(true)
    expect(result.placeholderCount).toBe(1)
    expect(result.firstPlaceholderIndex).toBe(1)
  })

  it('matches placeholders case-insensitively', () => {
    const result = usePlaceholderGate([
      { code: 'EXP_3', hotkey_id: hotkeyId, source_name: 'EXP_3', is_placeholder: true }
    ])

    expect(result.isDisabled).toBe(true)
    expect(result.placeholderCount).toBe(1)
  })

  it('matches only exp-number placeholder patterns', () => {
    const result = usePlaceholderGate([
      { code: 'motion-01', hotkey_id: hotkeyId, source_name: 'motion-01', is_placeholder: false },
      { code: 'unnamed-1', hotkey_id: hotkeyId, source_name: 'unnamed-1', is_placeholder: false },
      { code: 'hold-mic', hotkey_id: hotkeyId, source_name: 'hold-mic', is_placeholder: false }
    ])

    expect(result.placeholderCount).toBe(0)
  })
})

describe('AvatarImport review route', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      ...window,
      api: {
        pickAvatarFolder: vi.fn(),
        requestImportPlan: vi.fn(),
        commitAvatarOverrides: vi.fn(),
        onSidecarReady: vi.fn(() => vi.fn()),
        onSidecarCrash: vi.fn(() => vi.fn()),
        onSidecarLog: vi.fn(() => vi.fn())
      }
    })
  })

  it('disables Save while a placeholder remains', () => {
    renderImport(mockPlan([
      { code: 'exp_01', hotkey_id: hotkeyId, source_name: 'exp_01', is_placeholder: true }
    ]))

    expect(screen.getByRole('button', { name: /save catalogs/i })).toBeDisabled()
  })

  it('keeps Save and Cancel in a regular non-sticky page footer', () => {
    renderImport(mockPlan([
      { code: 'joy', hotkey_id: hotkeyId, source_name: 'Joy', is_placeholder: false }
    ]))

    const footer = screen.getByTestId('avatar-import-footer')
    expect(footer).toContainElement(screen.getByRole('button', { name: /cancel/i }))
    expect(footer).toContainElement(screen.getByRole('button', { name: /save catalogs/i }))
    expect(screen.getByTestId('avatar-import-footer-actions')).toBeInTheDocument()

    const css = readFileSync(new URL('../src/screens/AvatarImport/AvatarImport.module.css', import.meta.url), 'utf-8')
    const footerCss = css.match(/\.footer\s*\{[\s\S]*?\}/)?.[0] ?? ''
    expect(footerCss).not.toMatch(/position\s*:\s*sticky/)
    expect(footerCss).not.toMatch(/bottom\s*:\s*0/)
    expect(footerCss).not.toMatch(/background\s*:/)
  })

  it('keeps the placeholder save-disabled message visible and clickable', () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    renderImport(mockPlan([
      { code: 'exp_01', hotkey_id: hotkeyId, source_name: 'exp_01', is_placeholder: true }
    ]))

    const message = screen.getByRole('button', { name: /placeholder/i })
    expect(message).toBeVisible()
    fireEvent.click(message)
    expect(scrollIntoView).toHaveBeenCalled()
  })

  it('enables Save after user renames the placeholder', () => {
    renderImport(mockPlan([
      { code: 'exp_01', hotkey_id: hotkeyId, source_name: 'exp_01', is_placeholder: true }
    ]))

    const saveButton = screen.getByRole('button', { name: /save catalogs/i })
    expect(saveButton).toBeDisabled()
    fireEvent.change(screen.getByTestId('variant-code-input-0'), { target: { value: 'joy' } })
    expect(saveButton).not.toBeDisabled()
  })

  it('renders friendly Cubism 5.3 error without catalog tables', () => {
    renderImport(mockPlan([], 'unsupported_cubism_5_3'))

    expect(screen.queryByTestId('variant-table')).not.toBeInTheDocument()
    expect(screen.queryByTestId('event-table')).not.toBeInTheDocument()
    expect(screen.getByText(/Cubism 5\.3/i)).toBeInTheDocument()
  })

  it('deletes a variant row', () => {
    renderImport(mockPlan([
      { code: 'joy', hotkey_id: hotkeyId, source_name: 'Joy', is_placeholder: false },
      { code: 'wave', hotkey_id: hotkeyId, source_name: 'Wave', is_placeholder: false }
    ]))

    expect(screen.getByTestId('variant-row-0')).toBeInTheDocument()
    expect(screen.getByDisplayValue('wave')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('variant-delete-0'))
    expect(screen.queryByDisplayValue('joy')).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('wave')).toBeInTheDocument()
  })

  it('surfaces reserved-name validation inline', () => {
    renderImport(mockPlan([
      { code: 'joy', hotkey_id: hotkeyId, source_name: 'Joy', is_placeholder: false }
    ]))

    fireEvent.change(screen.getByTestId('variant-code-input-0'), { target: { value: 'think' } })
    expect(screen.getByText(/reserved/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save catalogs/i })).toBeDisabled()
  })
})
