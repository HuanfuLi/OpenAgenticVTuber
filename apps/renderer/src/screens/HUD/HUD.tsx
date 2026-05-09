import { useCallback, useEffect, useMemo, useState } from 'react'
import type { RigCapabilities } from '@contracts/rig-capabilities'
import { ToastStack } from '@/chrome/ToastStack'
import { COPY } from '@/lib/copy'
import { useStore } from '@/state/app-store'
import { HudEmptyState } from './HudEmptyState'
import { HudErrorState } from './HudErrorState'
import { HudFilterChips, type HudFilters } from './HudFilterChips'
import { HudFooterStatus } from './HudFooterStatus'
import { HudHeader } from './HudHeader'
import { HudLoadingState } from './HudLoadingState'
import { HudParamRow } from './HudParamRow'
import { getHudHttpBase, useHudStream } from './useHudStream'

type HudRigCapabilities = RigCapabilities & {
  hud_excluded_param_ids?: string[]
  hud_visible_param_ids?: string[]
}

interface HudParam {
  id: string
  displayName?: string
  range: [number, number]
}

const DEFAULT_RANGE: [number, number] = [0, 1]

async function fetchRigCapabilities(): Promise<HudRigCapabilities> {
  const base = await getHudHttpBase()
  if (!base) throw new Error('Sidecar is not ready')
  const resp = await fetch(`${base}/admin/rig-capabilities`)
  if (!resp.ok) throw new Error(`Rig capabilities failed: HTTP ${resp.status}`)
  return (await resp.json()) as HudRigCapabilities
}

function paramsFromCaps(caps: HudRigCapabilities): HudParam[] {
  const excluded = new Set(caps.hud_excluded_param_ids ?? [])
  const sourceIds = caps.hud_visible_param_ids?.length
    ? caps.hud_visible_param_ids
    : caps.writable_param_ids
  return sourceIds
    .filter((id) => !excluded.has(id))
    .map((id) => ({
      id,
      displayName: caps.cdi3_display_names[id],
      range: caps.param_ranges[id] ?? DEFAULT_RANGE
    }))
    .sort((a, b) => (a.displayName ?? a.id).localeCompare(b.displayName ?? b.id))
}

export function HudRoot() {
  const { pushToast } = useStore()
  const [filters, setFilters] = useState<HudFilters>({
    writable: true,
    animating: true,
    locked: true
  })
  const [params, setParams] = useState<HudParam[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadCaps = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const caps = await fetchRigCapabilities()
      setParams(paramsFromCaps(caps))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  const showLocksClearedToast = useCallback(() => {
    pushToast({ text: COPY.HUD.TOAST_LOCKS_CLEARED, ttlMs: 4000 })
  }, [pushToast])

  const reloadCapsAfterReconnect = useCallback(() => {
    void loadCaps()
  }, [loadCaps])

  const {
    paramValues,
    lockedIds,
    optimisticLockedIds,
    animatingIds,
    connectionState,
    sendSetLock,
    sendClearLock
  } = useHudStream(showLocksClearedToast, reloadCapsAfterReconnect)

  useEffect(() => {
    void loadCaps()
  }, [loadCaps])

  const activeLockedIds = useMemo(() => {
    const next = new Set(lockedIds)
    for (const id of optimisticLockedIds) next.add(id)
    return next
  }, [lockedIds, optimisticLockedIds])

  const visibleParams = useMemo(() => {
    return params.filter((param) => {
      if (!filters.writable) return false
      if (!filters.animating && animatingIds.has(param.id)) return false
      if (!filters.locked && activeLockedIds.has(param.id)) return false
      return true
    })
  }, [activeLockedIds, animatingIds, filters, params])

  return (
    <div className="hud-root">
      <HudHeader connectionState={connectionState} />
      <HudFilterChips filters={filters} onChange={setFilters} />
      {connectionState === 'reconnecting' ? (
        <div className="banner warn">{COPY.HUD.BANNER_DISCONNECTED}</div>
      ) : null}
      <main className="hud-list">
        {loading ? <HudLoadingState /> : null}
        {!loading && error ? <HudErrorState onRetry={() => void loadCaps()} /> : null}
        {!loading && !error && params.length === 0 ? <HudEmptyState kind="rig" /> : null}
        {!loading && !error && params.length > 0 && visibleParams.length === 0 ? (
          <HudEmptyState kind="filter" />
        ) : null}
        {!loading && !error
          ? visibleParams.map((param) => (
              <HudParamRow
                key={param.id}
                paramId={param.id}
                displayName={param.displayName}
                value={paramValues[param.id] ?? 0}
                range={param.range}
                isAnimating={animatingIds.has(param.id)}
                isLocked={activeLockedIds.has(param.id)}
                onSetLock={sendSetLock}
                onClearLock={sendClearLock}
              />
            ))
          : null}
      </main>
      <HudFooterStatus paramCount={visibleParams.length} lockCount={activeLockedIds.size} />
      <ToastStack />
    </div>
  )
}
