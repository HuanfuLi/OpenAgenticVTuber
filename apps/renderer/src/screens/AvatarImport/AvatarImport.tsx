import { useState } from 'react'
import type { AvatarImportPlan, ImportWarning } from '@contracts/avatar-import-plan'
import type { EventEntry } from '@contracts/event-entry'
import type { VariantEntry } from '@contracts/variant-entry'
import { COPY } from '@/lib/copy'
import { useStore } from '@/state/app-store'
import { EventTable } from './EventTable'
import { VariantTable, getVariantCodeErrors, type RowBadge } from './VariantTable'
import { usePlaceholderGate } from './usePlaceholderGate'
import styles from './AvatarImport.module.css'

interface AvatarImportProps {
  _testInitialPlan?: AvatarImportPlan
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>
    if (typeof record.message === 'string') return record.message
    if (typeof record.error === 'string') return record.error
    if (typeof record.detail === 'string') return record.detail
  }
  return String(error || COPY.AVATAR_IMPORT.SAVE_ERROR_FALLBACK)
}

export function AvatarImport({ _testInitialPlan }: AvatarImportProps = {}) {
  const { setView } = useStore()
  const [plan, setPlan] = useState<AvatarImportPlan | null>(_testInitialPlan ?? null)
  const [variants, setVariants] = useState<VariantEntry[]>(_testInitialPlan?.variants ?? [])
  const [events, setEvents] = useState<EventEntry[]>(_testInitialPlan?.events ?? [])
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const { isDisabled, placeholderCount, firstPlaceholderIndex } = usePlaceholderGate(variants)
  const variantErrors = getVariantCodeErrors(variants)
  const saveDisabled = isDisabled || variantErrors.size > 0 || saving
  const C = COPY.AVATAR_IMPORT

  const handleImport = async (): Promise<void> => {
    setErrorMsg(null)
    const folder = await window.api.pickAvatarFolder()
    if (!folder) return
    try {
      const nextPlan = await window.api.requestImportPlan(folder)
      setPlan(nextPlan)
      setVariants(nextPlan.variants)
      setEvents(nextPlan.events)
    } catch (error) {
      setErrorMsg(errorMessage(error))
    }
  }

  const handleSave = async (): Promise<void> => {
    if (!plan || saveDisabled) return
    setSaving(true)
    setErrorMsg(null)
    try {
      const result = await window.api.commitAvatarOverrides({ ...plan, variants, events })
      if (result.status !== 'ok') {
        setErrorMsg(result.status || C.SAVE_ERROR_FALLBACK)
        return
      }
      console.log(C.SUCCESS_TOAST)
      setView('chat')
    } catch (error) {
      setErrorMsg(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const scrollToFirstPlaceholder = (): void => {
    const row = document.querySelector(`[data-testid="variant-row-${firstPlaceholderIndex}"]`)
    row?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  if (!plan) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <header className={styles.header}>
            <h1>{C.PAGE_TITLE}</h1>
            <p>{C.PAGE_SUBTITLE}</p>
          </header>
          <button type="button" className="btn btn-primary" onClick={handleImport}>
            {C.IMPORT_BUTTON_LABEL}
          </button>
          {errorMsg && <p className={styles.error}>{errorMsg}</p>}
        </div>
      </div>
    )
  }

  if (
    plan.detected_type === 'unsupported_cubism_5_3' ||
    plan.detected_type === 'unsupported_no_model3'
  ) {
    return (
      <div className={styles.errorScreen}>
        <h1>{C.PAGE_TITLE}</h1>
        <p>
          {plan.detected_type === 'unsupported_cubism_5_3'
            ? C.ERROR_CUBISM_5_3
            : C.ERROR_NO_MODEL3}
        </p>
        <button type="button" className="btn btn-secondary" onClick={() => setView('chat')}>
          {C.CANCEL_BUTTON_LABEL}
        </button>
      </div>
    )
  }

  const badges: RowBadge[] = plan.existing_overrides
    ? variants.map((variant) => {
        const prior = plan.existing_overrides!.variants.find((entry) => entry.hotkey_id === variant.hotkey_id)
        if (!prior) return 'new'
        if (prior.code !== variant.code) return 'edited'
        return null
      })
    : variants.map(() => null)

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <header className={styles.header}>
          <h1>{C.PAGE_TITLE}</h1>
          <p>{C.PAGE_SUBTITLE}</p>
          <div className={styles.meta}>
            <span>{plan.avatar_name}</span>
            <span>
              {C.DETECTED_TYPE_LABEL}: {plan.detected_type}
            </span>
            <span>
              {C.SOURCE_PATH_LABEL}: {plan.source_rig_path}
            </span>
          </div>
        </header>

        {plan.warnings.length > 0 && (
          <ul className={styles.warnings} aria-label={C.WARNINGS_HEADING}>
            {plan.warnings.map((warning: ImportWarning, index: number) => (
              <li key={`${warning.kind}-${index}`}>
                [{warning.kind}] {warning.message}
              </li>
            ))}
          </ul>
        )}

        <h2 className={styles.heading}>{C.VARIANTS_HEADING}</h2>
        <VariantTable variants={variants} badges={badges} onChange={setVariants} />

        <h2 className={styles.heading}>{C.EVENTS_HEADING}</h2>
        <EventTable events={events} onChange={setEvents} />

        {errorMsg && <p className={styles.error}>{errorMsg}</p>}

        <footer className={styles.footer} data-testid="avatar-import-footer">
          <div>
            {isDisabled && (
              <button type="button" className={styles.saveDisabledMsg} onClick={scrollToFirstPlaceholder}>
                {C.SAVE_DISABLED_PLACEHOLDER(placeholderCount)}
              </button>
            )}
          </div>
          <div className={styles.footerActions} data-testid="avatar-import-footer-actions">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={saving}
              onClick={() => setView('chat')}
            >
              {C.CANCEL_BUTTON_LABEL}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={saveDisabled}
              onClick={handleSave}
            >
              {C.SAVE_BUTTON_LABEL}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
