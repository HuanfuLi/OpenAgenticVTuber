/* PLUMB-04 — Mandatory LLM setup screen.
 *
 * Ported from prototype src/views/LLMSetup.jsx with two changes per
 * 01-PROTOTYPE-DELTA.md:
 *  1. The stale 3-option <select> at lines 45-54 is replaced with the
 *     5-option list driven by COPY.LLM_SETUP.PROVIDERS (per CONTEXT.md D-06):
 *     LM Studio + Custom OpenAI-compat enabled; OpenAI/Anthropic/Gemini
 *     disabled with the verbatim "Coming in v2" tooltip.
 *  2. mockTestConnection -> real fetch() against /admin/llm-test SSE on the
 *     sidecar (HTTP, NOT text/event-stream — chunked text/plain consumed via
 *     body.getReader()). The streaming consumption lives in <TestLog />,
 *     which is mounted with a `key={logKey}` so each [Test] press remounts
 *     with a fresh line buffer (RESEARCH.md Open Q #4).
 *  3. mockSafeStorage.set -> window.api.saveStoredConfig via setup-store.
 *
 * UI-SPEC verbatim copy shown by this screen (sourced from `@/lib/copy`):
 *   header:        "Connect a language model"
 *   subhead:       "AgenticLLMVTuber sends every message to a language model you control."
 *   model helper:  "auto-detect if blank"
 *   apikey helper: "LM Studio: skip"
 *   test btn:      "Test connection"     /  "Test connection again"
 *   continue btn:  "Continue →"
 *   endpoint:      "http://localhost:1234/v1"  (LM Studio default)
 */

import { useEffect, useState } from 'react'
import { COPY } from '@/lib/copy'
import { completeSetup, type Provider, type ProviderConfig } from '@/state/setup-store'
import { ProviderSelect } from './ProviderSelect'
import { TestLog } from './TestLog'

type TestPhase = 'idle' | 'testing' | 'success' | 'error'

interface FormState {
  provider: Provider
  endpointUrl: string
  apiKey: string
  modelName: string
}

const DEFAULT_FORM: FormState = {
  provider: 'lm_studio',
  endpointUrl: 'http://localhost:1234/v1',
  apiKey: '',
  modelName: ''
}

export function LLMSetup() {
  const C = COPY.SETUP
  const C2 = COPY.LLM_SETUP
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [phase, setPhase] = useState<TestPhase>('idle')
  const [errorKind, setErrorKind] = useState<'unreachable' | null>(null)
  const [logKey, setLogKey] = useState(0) // bump to remount TestLog with empty buffer

  // Auto-fill localhost:1234 when LM Studio selected; clear endpoint when
  // switching to custom_openai (user must supply their own).
  useEffect(() => {
    if (form.provider === 'lm_studio' && !form.endpointUrl) {
      setForm((f) => ({ ...f, endpointUrl: 'http://localhost:1234/v1' }))
    }
  }, [form.provider, form.endpointUrl])

  const onTest = (): void => {
    setLogKey((k) => k + 1) // RESEARCH Open Q #4: clear-by-remount on each press
    setPhase('testing')
    setErrorKind(null)
  }

  const onTestResult = (success: boolean, ek: 'unreachable' | null): void => {
    setPhase(success ? 'success' : 'error')
    setErrorKind(ek)
  }

  const onContinue = async (): Promise<void> => {
    const cfg: ProviderConfig = { ...form }
    await completeSetup({
      provider: cfg,
      hasCompletedSetup: true,
      schemaVersion: 1
    })
    // setup-store flips to 'ready' -> App.tsx swaps LLMSetup for AppShell.
  }

  const canContinue = phase === 'success'

  return (
    <div className="view" style={{ background: 'var(--background)' }} data-theme-surface>
      <div className="setup">
        <h1>{C2.HEADER}</h1>
        <p className="sub">{C2.SUB}</p>

        <div className="field">
          <label className="label" htmlFor="provider">
            {C2.PROVIDER_LABEL}
          </label>
          {/*
            5-option <select> per DELTA bug-fix + CONTEXT.md D-06.
            Extracted into ProviderSelect for clarity; disabled options surface
            DISABLED_PROVIDER_TT via the native title attribute.
          */}
          <ProviderSelect
            value={form.provider}
            onChange={(p) => setForm((f) => ({ ...f, provider: p }))}
          />
        </div>

        <div className="field">
          <div className="field-row">
            <label className="label" htmlFor="endpoint">
              {C2.ENDPOINT_LABEL}
            </label>
            <span className="helper">{C.ENDPOINT_HELP}</span>
          </div>
          <input
            id="endpoint"
            className="input"
            value={form.endpointUrl}
            onChange={(e) => setForm((f) => ({ ...f, endpointUrl: e.target.value }))}
            placeholder="http://localhost:1234/v1"
          />
        </div>

        <div className="field">
          <div className="field-row">
            <label className="label" htmlFor="model">
              {C2.MODEL_LABEL}
            </label>
            <span className="helper">{C2.MODEL_HELPER}</span>
          </div>
          <input
            id="model"
            className="input"
            value={form.modelName}
            onChange={(e) => setForm((f) => ({ ...f, modelName: e.target.value }))}
            placeholder={C2.MODEL_PLACEHOLDER}
          />
        </div>

        <div className="field">
          <div className="field-row">
            <label className="label" htmlFor="apikey">
              {C2.APIKEY_LABEL}
            </label>
            {form.provider === 'lm_studio' && (
              <span className="helper">{C2.APIKEY_HELPER_LMSTUDIO}</span>
            )}
          </div>
          <input
            id="apikey"
            type="password"
            className="input"
            value={form.apiKey}
            onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
            disabled={form.provider === 'lm_studio'}
            placeholder={form.provider === 'lm_studio' ? C.APIKEY_PLACEHOLDER : 'sk-...'}
          />
        </div>

        <button
          className="btn btn-secondary"
          onClick={onTest}
          disabled={phase === 'testing'}
          style={{ alignSelf: 'flex-start' }}
        >
          {phase === 'testing'
            ? C.TEST_BTN_RUNNING
            : phase === 'success'
              ? C2.CTA_TEST_AGAIN
              : C2.CTA_TEST}
        </button>

        {/* TestLog — separate component, mounted only after the user has
            pressed [Test] at least once. Bumping logKey remounts it with a
            fresh line buffer per RESEARCH Open Q #4. */}
        {phase !== 'idle' && (
          <TestLog
            key={logKey}
            form={form}
            onResult={onTestResult}
          />
        )}

        {phase === 'error' && errorKind === 'unreachable' && (
          <div
            className="card mt-2"
            style={{
              borderColor: 'color-mix(in oklab, var(--destructive), transparent 50%)'
            }}
          >
            <div className="semibold" style={{ color: 'var(--destructive)' }}>
              ⚠ {C.ERROR_UNREACHABLE_TITLE}
            </div>
            <ol
              style={{
                margin: '8px 0 0 18px',
                padding: 0,
                color: 'var(--muted-foreground)',
                fontSize: 14
              }}
            >
              {C.ERROR_UNREACHABLE_STEPS.map((s, i) => (
                <li key={i} style={{ marginBottom: 4 }}>
                  {s}
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="setup-actions">
          <button
            className="btn btn-link"
            onClick={() => alert('(mock) Would open: setup help docs')}
          >
            {C.HELP_LINK}
          </button>
          <button
            className="btn btn-primary"
            disabled={!canContinue}
            onClick={onContinue}
            aria-label="Continue to chat"
          >
            {C2.CTA_CONTINUE}
          </button>
        </div>
      </div>
    </div>
  )
}
