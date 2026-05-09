import { useEffect, useMemo, useRef, useState } from 'react'
import { Lock, Unlock } from '@/lib/icons'

export interface HudParamRowProps {
  paramId: string
  displayName?: string
  value: number
  range: [number, number]
  isAnimating: boolean
  isLocked: boolean
  onSetLock: (paramId: string, value: number) => void
  onClearLock: (paramId: string) => void
}

function stepFor(range: [number, number]): number {
  const width = Math.abs(range[1] - range[0])
  return width > 0 ? width / 200 : 0.01
}

export function HudParamRow({
  paramId,
  displayName,
  value,
  range,
  isAnimating,
  isLocked,
  onSetLock,
  onClearLock
}: HudParamRowProps) {
  const label = displayName || paramId
  const step = useMemo(() => stepFor(range), [range])
  const [localValue, setLocalValue] = useState<number | null>(null)
  const dragStartRef = useRef<number | null>(null)
  const currentValue = localValue ?? value
  const sliderId = `hud-slider-${paramId.replace(/[^a-zA-Z0-9_-]/g, '-')}`

  useEffect(() => {
    if (!isLocked) setLocalValue(null)
  }, [isLocked, value])

  const engage = (nextValue: number): void => {
    setLocalValue(nextValue)
    const start = dragStartRef.current ?? value
    if (Math.abs(nextValue - start) >= step * 2 || isLocked) {
      onSetLock(paramId, nextValue)
    }
  }

  return (
    <div className={`hud-row${isLocked ? ' locked' : ''}${isAnimating ? ' animating' : ''}`}>
      <div className="hud-row-label">
        <label htmlFor={sliderId}>{label}</label>
        {displayName ? <div className="hud-param-id mono">{paramId}</div> : null}
      </div>
      <div className="hud-row-value mono">{currentValue.toFixed(2)}</div>
      <input
        id={sliderId}
        aria-label={`${label} value`}
        className={`hud-slider${isLocked ? ' locked' : ''}`}
        type="range"
        min={range[0]}
        max={range[1]}
        step={step}
        value={currentValue}
        onPointerDown={() => {
          dragStartRef.current = currentValue
        }}
        onChange={(event) => engage(Number(event.currentTarget.value))}
        onPointerUp={() => {
          if (localValue !== null) onSetLock(paramId, localValue)
          dragStartRef.current = null
        }}
      />
      <button
        type="button"
        role="switch"
        aria-checked={isLocked}
        aria-label={isLocked ? `Unlock ${label}` : `Lock ${label}`}
        className={`hud-lock-btn${isLocked ? ' locked' : ''}`}
        onClick={() => {
          if (isLocked) onClearLock(paramId)
        }}
      >
        {isLocked ? <Lock /> : <Unlock />}
      </button>
    </div>
  )
}
