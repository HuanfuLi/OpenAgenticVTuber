import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { HudParamRow } from '@/screens/HUD/HudParamRow'

function renderRow(overrides: Partial<Parameters<typeof HudParamRow>[0]> = {}) {
  const onSetLock = vi.fn()
  const onClearLock = vi.fn()
  render(
    <HudParamRow
      paramId="ParamAngleX"
      displayName="Angle X"
      value={0.5}
      range={[0, 1]}
      isAnimating={true}
      isLocked={false}
      onSetLock={onSetLock}
      onClearLock={onClearLock}
      {...overrides}
    />
  )
  return { onSetLock, onClearLock }
}

describe('HudParamRow', () => {
  it('renders display name, raw param ID, two-decimal value, slider, and lock toggle', () => {
    renderRow()

    expect(screen.getByText('Angle X')).toBeInTheDocument()
    expect(screen.getByText('ParamAngleX')).toBeInTheDocument()
    expect(screen.getByText('0.50')).toBeInTheDocument()
    expect(screen.getByRole('slider')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Lock Angle X' })).toBeInTheDocument()
  })

  it('falls back to mono param ID when no display name is provided', () => {
    renderRow({ displayName: undefined })

    expect(screen.getByText('ParamAngleX')).toBeInTheDocument()
    expect(screen.queryByText('Angle X')).toBeNull()
  })

  it('bounds the native range input from RigCapabilities.param_ranges', () => {
    renderRow({ range: [-30, 30], value: 0 })
    const slider = screen.getByRole('slider')

    expect(slider).toHaveAttribute('min', '-30')
    expect(slider).toHaveAttribute('max', '30')
  })

  it('fires set-lock on first non-trivial slider movement', () => {
    const { onSetLock } = renderRow({ value: 0, range: [0, 1] })
    const slider = screen.getByRole('slider')

    fireEvent.pointerDown(slider)
    fireEvent.change(slider, { target: { value: '0.03' } })

    expect(onSetLock).toHaveBeenCalledWith('ParamAngleX', 0.03)
  })

  it('keeps the lock engaged on pointer release and sends the final value', () => {
    const { onSetLock, onClearLock } = renderRow({ value: 0, range: [0, 1] })
    const slider = screen.getByRole('slider')

    fireEvent.pointerDown(slider)
    fireEvent.change(slider, { target: { value: '0.3' } })
    fireEvent.pointerUp(slider)

    expect(onSetLock).toHaveBeenLastCalledWith('ParamAngleX', 0.3)
    expect(onClearLock).not.toHaveBeenCalled()
  })

  it('clicking the locked toggle clears the lock', () => {
    const { onClearLock } = renderRow({ isLocked: true })

    fireEvent.click(screen.getByRole('switch', { name: 'Unlock Angle X' }))

    expect(onClearLock).toHaveBeenCalledWith('ParamAngleX')
  })
})
