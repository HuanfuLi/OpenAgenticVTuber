import { COPY } from '@/lib/copy'
import {
  DEFAULT_PTT_SHORTCUT,
  isReservedShortcut,
  normalizeShortcut,
  type VadSensitivity,
  type VoiceInputSettings
} from '@/state/audio-settings'

interface VoiceInputPreferencesFieldsProps {
  settings: VoiceInputSettings
  onChange: (settings: VoiceInputSettings) => void
}

export function VoiceInputPreferencesFields({
  settings,
  onChange
}: VoiceInputPreferencesFieldsProps) {
  const C = COPY.SETTINGS
  const normalizedShortcut = normalizeShortcut(settings.pttShortcut)
  const shortcutReserved = isReservedShortcut(settings.pttShortcut)

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

      <div className="kv-row" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="v">{C.VOICE_IN_VAD_ENABLED}</div>
          <div className="tx-sm muted" style={{ marginTop: 2 }}>{C.VOICE_IN_VAD_HELP}</div>
        </div>
        <button
          className={`switch${settings.vad.enabled ? ' on' : ''}`}
          aria-label={C.VOICE_IN_VAD_ENABLED}
          aria-checked={settings.vad.enabled}
          role="switch"
          type="button"
          onClick={() => onChange({
            ...settings,
            vad: { ...settings.vad, enabled: !settings.vad.enabled }
          })}
        />
      </div>

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
