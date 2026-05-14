import { COPY } from '@/lib/copy'
import {
  DEFAULT_PTT_SHORTCUT,
  isReservedShortcut,
  normalizeShortcut,
  type NoHeadphonesStatus,
  type VadSensitivity,
  type VoiceInputSettings
} from '@/state/audio-settings'
import type { AecDiagnosticSnapshot } from '@/audio/aec-diagnostics'

interface VoiceInputPreferencesFieldsProps {
  settings: VoiceInputSettings
  aecDiagnostics?: AecDiagnosticSnapshot | null
  onChange: (settings: VoiceInputSettings) => void
}

function noHeadphonesHelp(status: NoHeadphonesStatus): string {
  const C = COPY.SETTINGS
  if (status === 'ready') return C.VOICE_IN_NO_HEADPHONES_READY_HELP
  if (status === 'limited') return C.VOICE_IN_NO_HEADPHONES_LIMITED_HELP
  return C.VOICE_IN_NO_HEADPHONES_UNSAFE_HELP
}

function describeAecValue(value: unknown): string {
  if (value === true) return COPY.SETTINGS.VOICE_IN_AEC_ON
  if (value === false) return COPY.SETTINGS.VOICE_IN_AEC_OFF
  return COPY.SETTINGS.VOICE_IN_AEC_UNKNOWN
}

function describeAecDiagnostics(diagnostics: AecDiagnosticSnapshot | null | undefined): string | null {
  if (!diagnostics) return null
  const C = COPY.SETTINGS
  const source = diagnostics.source === 'vad' ? C.VOICE_IN_INPUT_VAD : C.VOICE_IN_INPUT_PUSH_TO_TALK
  const echo = describeAecValue(diagnostics.applied.echoCancellation)
  const noise = describeAecValue(diagnostics.applied.noiseSuppression)
  return `${C.VOICE_IN_AEC_DIAGNOSTICS}: ${source}; ${C.VOICE_IN_AEC_ECHO} ${echo}; ${C.VOICE_IN_AEC_NOISE} ${noise}.`
}

export function VoiceInputPreferencesFields({
  settings,
  aecDiagnostics,
  onChange
}: VoiceInputPreferencesFieldsProps) {
  const C = COPY.SETTINGS
  const normalizedShortcut = normalizeShortcut(settings.pttShortcut)
  const shortcutReserved = isReservedShortcut(settings.pttShortcut)
  const aecSummary = describeAecDiagnostics(aecDiagnostics)
  const updateNoHeadphonesStatus = (status: NoHeadphonesStatus): void => {
    const nextNoHeadphones = {
      ...settings.noHeadphones,
      status
    }
    onChange({
      ...settings,
      noHeadphones: nextNoHeadphones,
      vad: status === 'unsafe' && !nextNoHeadphones.unsafeOverride
        ? { ...settings.vad, enabled: false }
        : settings.vad
    })
  }
  const setUnsafeOverride = (unsafeOverride: boolean): void => {
    onChange({
      ...settings,
      noHeadphones: { ...settings.noHeadphones, unsafeOverride },
      vad: unsafeOverride ? settings.vad : { ...settings.vad, enabled: false }
    })
  }

  return (
    <>
      <div className="field">
        <label className="label" htmlFor="voice-in-ptt-shortcut">{C.VOICE_IN_PTT_SHORTCUT}</label>
        <input
          id="voice-in-ptt-shortcut"
          className="input"
          value={settings.pttShortcut}
          placeholder={DEFAULT_PTT_SHORTCUT}
          onChange={(e) => onChange({ ...settings, pttShortcut: e.target.value })}
          onBlur={() => onChange({ ...settings, pttShortcut: normalizedShortcut })}
        />
        <div className={`tx-sm ${shortcutReserved ? '' : 'muted'}`}>
          {shortcutReserved ? C.VOICE_IN_PTT_SHORTCUT_RESERVED : C.VOICE_IN_PTT_SHORTCUT_HELP}
        </div>
      </div>

      <div className="field">
        <label className="label" htmlFor="voice-in-no-headphones-status">{C.VOICE_IN_NO_HEADPHONES_STATUS}</label>
        <select
          id="voice-in-no-headphones-status"
          className="select"
          value={settings.noHeadphones.status}
          onChange={(e) => updateNoHeadphonesStatus(e.target.value as NoHeadphonesStatus)}
        >
          <option value="ready">{C.VOICE_IN_NO_HEADPHONES_READY}</option>
          <option value="limited">{C.VOICE_IN_NO_HEADPHONES_LIMITED}</option>
          <option value="unsafe">{C.VOICE_IN_NO_HEADPHONES_UNSAFE}</option>
        </select>
        <div className="tx-sm muted" style={{ marginTop: 2 }}>{noHeadphonesHelp(settings.noHeadphones.status)}</div>
      </div>

      <div className="field" aria-label={C.VOICE_IN_AEC_DIAGNOSTICS}>
        <div className="label">{C.VOICE_IN_AEC_DIAGNOSTICS}</div>
        <div className="tx-sm muted" style={{ marginTop: 2 }}>
          {aecSummary ?? C.VOICE_IN_AEC_EMPTY}
        </div>
      </div>

      {settings.noHeadphones.status === 'unsafe' && (
        <div className="kv-row" style={{ alignItems: 'flex-start' }}>
          <div>
            <div className="v">{C.VOICE_IN_NO_HEADPHONES_OVERRIDE}</div>
            <div className="tx-sm muted" style={{ marginTop: 2 }}>{C.VOICE_IN_NO_HEADPHONES_OVERRIDE_HELP}</div>
          </div>
          <button
            className={`switch${settings.noHeadphones.unsafeOverride ? ' on' : ''}`}
            aria-label={C.VOICE_IN_NO_HEADPHONES_OVERRIDE}
            aria-checked={settings.noHeadphones.unsafeOverride}
            role="switch"
            type="button"
            onClick={() => setUnsafeOverride(!settings.noHeadphones.unsafeOverride)}
          />
        </div>
      )}

      <div className="field">
        <label className="label" htmlFor="voice-in-vad-sensitivity">{C.VOICE_IN_VAD_SENSITIVITY}</label>
        <select
          id="voice-in-vad-sensitivity"
          className="select"
          value={settings.vad.sensitivity}
          onChange={(e) => onChange({
            ...settings,
            vad: { ...settings.vad, sensitivity: e.target.value as VadSensitivity }
          })}
        >
          <option value="low">{C.VOICE_IN_VAD_SENSITIVITY_LOW}</option>
          <option value="medium">{C.VOICE_IN_VAD_SENSITIVITY_MEDIUM}</option>
          <option value="high">{C.VOICE_IN_VAD_SENSITIVITY_HIGH}</option>
        </select>
      </div>

      <div className="field">
        <label className="label" htmlFor="voice-in-vad-timeout">{C.VOICE_IN_VAD_SILENCE_TIMEOUT}</label>
        <input
          id="voice-in-vad-timeout"
          className="input"
          type="number"
          min={500}
          max={5000}
          step={100}
          value={settings.vad.silenceTimeoutMs}
          onChange={(e) => onChange({
            ...settings,
            vad: {
              ...settings.vad,
              silenceTimeoutMs: Number(e.target.value) || settings.vad.silenceTimeoutMs
            }
          })}
        />
      </div>
    </>
  )
}
