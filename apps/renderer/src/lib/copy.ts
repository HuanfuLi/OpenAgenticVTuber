// SPEC §Copywriting Contract — every user-visible string lives here.
// Ported verbatim from prototype src/lib/copy.js (2026-05-06). Typed `as const`.

export const COPY = {
  'dev.bodySway.title': 'Body-sway strategy',
  'dev.bodySway.headOnly': 'head_only',
  'dev.bodySway.proxyParam': 'proxy_param (Lean Forward)',
  'dev.bodySway.exp3Modulation': 'exp3_modulation (.exp3.json)',
  APP: {
    TITLE: 'AgenticLLMVTuber'
  },
  SETUP: {
    HEADER: 'Connect a language model',
    SUB: 'AgenticLLMVTuber sends every message to a language model you control.',
    PROVIDER_LABEL: 'Provider',
    ENDPOINT_LABEL: 'Endpoint URL',
    ENDPOINT_HELP: '(http://… or https://…)',
    MODEL_LABEL: 'Model',
    MODEL_HELP: 'auto-detect if blank',
    APIKEY_LABEL: 'API key',
    APIKEY_PLACEHOLDER: 'LM Studio: skip',
    TEST_BTN: 'Test connection',
    TEST_BTN_RUNNING: 'Testing…',
    LOG_TITLE: 'Connection test log',
    HELP_LINK: 'Setup help ↗',
    CONTINUE: 'Continue →',
    ERROR_UNREACHABLE_TITLE: 'LLM unreachable',
    ERROR_UNREACHABLE_STEPS: [
      'LM Studio is open.',
      'A model is loaded in the chat tab.',
      'Local server is running on the endpoint above.'
    ]
  },
  LLM_SETUP: {
    HEADER: 'Connect a language model',
    SUB: 'AgenticLLMVTuber sends every message to a language model you control.',
    PROVIDER_LABEL: 'Provider',
    ENDPOINT_LABEL: 'Endpoint URL',
    ENDPOINT_PLACEHOLDER: 'http://localhost:1234/v1',
    MODEL_LABEL: 'Model',
    MODEL_HELPER: 'auto-detect if blank',
    MODEL_PLACEHOLDER: 'auto-detect',
    APIKEY_LABEL: 'API key',
    APIKEY_HELPER_LMSTUDIO: 'LM Studio: skip',
    CTA_TEST: 'Test connection',
    CTA_TEST_AGAIN: 'Test connection again',
    CTA_CONTINUE: 'Continue →',
    SUCCESS_FINAL: 'Connection looks good. You can continue.',
    DISABLED_PROVIDER_TT:
      'Hosted-provider support lands in v2. Use the Custom OpenAI-compatible option for now if you need a hosted endpoint.',
    PROVIDERS: [
      { id: 'lmstudio', label: 'LM Studio', status: '✓ working', enabled: true },
      { id: 'custom', label: 'Custom OpenAI-compat', status: '✓ working', enabled: true },
      { id: 'openai', label: 'OpenAI', status: '⏳ Coming v2', enabled: false },
      { id: 'anthropic', label: 'Anthropic', status: '⏳ Coming v2', enabled: false },
      { id: 'gemini', label: 'Gemini', status: '⏳ Coming v2', enabled: false }
    ]
  },
  CHAT: {
    EMPTY_VTS_HEAD: 'To see your avatar, start VTube Studio and load a Live2D model.',
    EMPTY_VTS_BODY: "We'll connect automatically.",
    EMPTY_VTS_LINK: 'Open VTube Studio docs ↗',
    EMPTY_READY_HEAD: 'Your avatar is ready.',
    EMPTY_READY_BODY: 'Type below to start a conversation.',
    EMPTY_READY_FOOTER:
      'Closing the app clears this conversation — persistence comes in a later milestone.',
    INPUT_PLACEHOLDER: 'Type a message...',
    // Phase 2 (plan 02-03) -- streaming-chat affordances. Single-char ellipsis
    // (U+2026) per UI-SPEC §Typography (italic --muted-foreground).
    THINKING: 'Thinking…',
    SPEAKING: 'Teto is still speaking…',
    STREAM_ERROR: "The model couldn't finish that reply. Try again.",
    CONTEXT_OVERFLOW:
      "Conversation got too long and won't fit in the model anymore. Close the app to start fresh."
  },
  HISTORY: {
    HEADER: 'History',
    PLACEHOLDER_HEAD: 'Conversation history arrives in milestone-2.',
    PLACEHOLDER_BODY: 'This conversation clears when you close the app.',
    NEW_THREAD: '+ New thread',
    SEARCH: 'search threads'
  },
  AGENT: {
    PLACEHOLDER_HEAD: 'Agent mode arrives in milestone-3.',
    PLACEHOLDER_BODY:
      "You'll be able to delegate goals to a computer-use sub-agent (daily routines, GUI workflows) and a CLI sub-agent (code/file/web tasks via Claude Code).",
    TOGGLE_DISABLED_TT: 'Agent mode arrives in milestone-3.'
  },
  STATUS: {
    HEADER: 'Status',
    LLM: 'LLM',
    VTS: 'VTS',
    SIDECAR: 'Sidecar',
    RETEST: 'Re-test connection',
    TESTING: 'Testing...'
  },
  SETTINGS: {
    HEADER: 'Settings',
    ANCHORS_HINT: 'Connection · Avatars · VTube Studio · …',
    CONN_HEADER: 'Connection / Models',
    CONN_RETEST: 'Re-test',
    CONN_CHANGE: 'Change provider →',
    CONN_CHANGE_DISABLED_TT: 'Re-configure provider lands in v1.',
    AVATAR_CATALOGS_HEADER: 'Avatar catalogs',
    AVATAR_CATALOGS_HELP: 'Import or edit avatar variant and event catalogs.',
    PLUGINS_HEADER: 'Body motion plugin',
    PLUGINS_HELP: 'Selected at sidecar startup.',
    PLUGINS_EMPTY: 'No body motion plugins found.',
    PLUGINS_SAVING: 'Saving...',
    PLUGINS_SAVED: 'Saved. Sidecar restarting...',
    PLUGINS_ERROR: 'Could not save plugin selection.',
    APPEARANCE_HEADER: 'Appearance',
    MODE_LABEL: 'Mode',
    MODE_OPTIONS: [
      { id: 'auto', label: 'Match system', isDefault: true },
      { id: 'light', label: 'Light' },
      { id: 'dark', label: 'Dark' }
    ],
    LIGHT_ACCENT_LABEL: 'Light accent',
    LIGHT_ACCENT_HELP: 'Used when the app is in light mode.',
    LIGHT_ACCENT_OPTIONS: [
      { id: 'blush', label: 'Blush', isDefault: true },
      { id: 'sunrise', label: 'Sunrise' },
      { id: 'ember', label: 'Ember' }
    ],
    DARK_BG_LABEL: 'Dark background',
    DARK_BG_HELP: 'Used when the app is in dark mode.',
    DARK_BG_OPTIONS: [
      { id: 'midnight', label: 'Midnight', isDefault: true },
      { id: 'onyx', label: 'Onyx' }
    ],
    DARK_ACCENT_LABEL: 'Dark accent',
    DARK_ACCENT_HELP: 'Used when the app is in dark mode.',
    DARK_ACCENT_OPTIONS: [
      { id: 'sky', label: 'Sky', isDefault: true },
      { id: 'pewter', label: 'Pewter' }
    ],
    PREVIEW_HEADER: 'Preview',
    DISABLED_LIGHT_TT: 'Active when Light mode resolves.',
    DISABLED_DARK_TT: 'Active when Dark mode resolves.',
    DIAG_HEADER: 'Diagnostics',
    DIAG_SHOW_LOGS: 'Show log panel',
    DIAG_SHOW_LOGS_HINT: 'Sidecar logs appear in a drawer above the bottom rail.',
    DIAG_OPEN_FOLDER: 'Open log folder',
    DIAG_RESET: 'Reset all state',
    DIAG_LOG_LEVEL: 'Log level',
    DIAG_LOG_LEVEL_HELP: 'Coming in milestone-2.',
    DIAG_TELEMETRY: 'Telemetry',
    DIAG_TELEMETRY_HELP: 'Coming in milestone-5. Telemetry is opt-in only.',
    TTS_HEADER: 'TTS / Voice out',
    TTS_ENGINE: 'Engine',
    TTS_ENGINE_VAL: 'Piper local TTS',
    TTS_VOICE: 'Voice',
    TTS_VOICE_VAL: 'en_US-amy-medium',
    TTS_OUTPUT: 'Output device',
    TTS_OUTPUT_VAL: 'System default',
    TTS_LIPSYNC: 'Lipsync',
    TTS_LIPSYNC_VAL: 'VTube Studio ParamMouthOpenY from RMS volume',
    TTS_HELP: 'Phase 3 is active: replies synthesize locally and play through the default audio device.',
    ABOUT_HEADER: 'About',
    ABOUT_VERSION: 'Version',
    ABOUT_VERSION_VAL: '0.1.0-skeleton',
    ABOUT_CHANNEL: 'Update channel',
    ABOUT_CHANNEL_VAL: 'Coming in milestone-5.',
    ABOUT_LINKS: 'Docs · License · Third-party notices',
    PLACEHOLDERS: [
      // §2-§13 from SPEC IA table
      { num: 2, title: 'Avatars', milestone: 2, body: 'Add Live2D avatars from .vtube.json or Cubism folders, set defaults, manage per-avatar memory.' },
      { num: 3, title: 'Per-avatar settings', milestone: 2, body: 'Edit personality, voice, hit zones, and action mappings per avatar.' },
      { num: 4, title: 'VTube Studio', milestone: 1.5, body: 'Configure host:port, plugin re-auth, default rig, lipsync mode, smoke-pass tools.' },
      { num: 6, title: 'Voice in', milestone: 4, body: 'Push-to-talk key, VAD sensitivity, ASR model size, interrupt behavior.' },
      { num: 7, title: 'Conversation', milestone: 2, body: 'System prompt prefix, temperature, max tokens, streaming, reasoning UI.' },
      { num: 8, title: 'Memory', milestone: 2, body: 'Shared user-facts, retrieval depth, "remember this" hotkey, FTS index, wipe.' },
      { num: 9, title: 'Skills', milestone: 5, body: 'Install skills from a folder, grant per-skill permissions.' },
      { num: 10, title: 'Agent', milestone: 3, body: 'Default permissions, file-ops allowlist, audit log, kill-switch hotkey.' },
      { num: 11, title: 'Scheduler', milestone: 3, body: 'Saved goal templates, cron schedules, missed-runs behavior.' },
      { num: 12, title: 'Form factor', milestone: 4, body: 'Window vs pet mode, opacity, click-through, always-on-top, drag inertia.' },
      { num: 13, title: 'Hotkeys', milestone: 4, body: 'Customize the kill-switch, push-to-talk, hide-window, and test-prop bindings.' }
    ]
  },
  HUD: {
    HUD_HEADING: 'Slider HUD',
    OPEN_HUD_BUTTON: 'Open HUD',
    OPEN_HUD_HELP: 'Open the slider HUD to inspect and lock individual rig parameters.',
    FILTER_WRITABLE: 'Writable',
    FILTER_ANIMATING: 'Animating',
    FILTER_LOCKED: 'Locked',
    FOOTER_TEMPLATE: '{N} params - {M} locked - 15 Hz',
    EMPTY_FILTER_HEADING: 'No params match the active filters.',
    EMPTY_FILTER_BODY: 'Toggle a chip back on to see more params.',
    EMPTY_RIG_HEADING: 'This rig exposes no parameters the HUD can lock.',
    EMPTY_RIG_BODY: 'Add or import a rig with at least one writable parameter.',
    LOADING_BODY: 'Loading rig parameters...',
    LOADING_ERROR: "Couldn't load rig parameters. Is the sidecar running?",
    RETRY_BUTTON: 'Retry',
    BANNER_DISCONNECTED: 'HUD lost connection to the sidecar. Reconnecting...',
    TOAST_LOCKS_CLEARED: 'Avatar changed - locks cleared.'
  },
  ERRORS: {
    LLM_UNREACHABLE_BANNER: 'LLM is unreachable. Start LM Studio and click Retry.',
    VTS_DISCONNECTED: 'VTube Studio disconnected — avatar motion paused. Will reconnect when VTS is back.',
    VTS_AUTH_DENIED: 'Plugin authorization denied in VTube Studio. [Re-request] or grant in VTS → Settings → Plugins.',
    SIDECAR_RESTART: 'Sidecar restarting...',
    SIDECAR_REPEAT: 'Sidecar has crashed twice. Click Restart sidecar or check the log folder for details.',
    SIDECAR_TOAST: 'Sidecar crashed — restarting...',
    TTS_UNAVAILABLE: 'TTS unavailable — replies will be text-only. [More info]',
    REFUSED_LMSTUDIO_HEAD: "LM Studio doesn't seem to be running.",
    NO_MODEL: 'No model is loaded in LM Studio.'
  },
  RESET: {
    TITLE: 'Reset all state?',
    BODY: 'This clears your provider configuration, appearance preferences, window settings, and any other saved preferences. The next launch will start at the LLM setup screen. This cannot be undone.',
    CANCEL: 'Cancel',
    CONFIRM: 'Reset everything'
  },
  AVATAR_IMPORT: {
    PAGE_TITLE: 'Import Avatar',
    PAGE_SUBTITLE: 'Review the auto-detected variants + events from your rig and Save when ready.',
    IMPORT_BUTTON_LABEL: 'Choose folder…',
    SETTINGS_BUTTON_LABEL: 'Edit avatar catalogs',
    SAVE_BUTTON_LABEL: 'Save catalogs',
    SAVE_DISABLED_PLACEHOLDER: (n: number) =>
      `Save disabled — ${n} placeholder name${n === 1 ? '' : 's'} remain. Click here to scroll to the first.`,
    VARIANTS_HEADING: 'Variants (toggle expressions)',
    VARIANTS_EMPTY: 'This rig exposes no toggle expressions.',
    EVENTS_HEADING: 'Events (one-shot motions)',
    EVENTS_EMPTY: 'This rig exposes no motion events.',
    SOURCE_NAME_HEADING: 'Source name (rig-side)',
    CODE_HEADING: 'Code (LLM-facing)',
    PREVIEW_HEADING: 'Preview',
    DELETE_LABEL: 'Delete row',
    SUCCESS_TOAST: 'Avatar imported successfully',
    ERROR_CUBISM_5_3:
      "This avatar uses Cubism 5.3 features that VTube Studio doesn't support yet. " +
      'Please re-export the rig from Cubism Editor with target version 5.2 or earlier.',
    ERROR_NO_MODEL3:
      "This folder doesn't look like a runtime Live2D export. " +
      'If you have a .cmo3 Cubism Editor project, export it first ' +
      '(File → Export to .moc3 in Cubism Editor).',
    NEW_BADGE: 'NEW',
    EDITED_BADGE: 'edited',
    CANCEL_BUTTON_LABEL: 'Cancel',
    VALIDATION_ERROR_RESERVED: (code: string) => `'${code}' is a reserved LLM-protocol name`,
    VALIDATION_ERROR_DUPLICATE: (code: string) => `'${code}' is already used by another row`,
    VALIDATION_ERROR_SLUG: 'Code must match a-z 0-9 hyphens, start with a letter, max 31 chars',
    DETECTED_TYPE_LABEL: 'Detected type',
    SOURCE_PATH_LABEL: 'Source path',
    WARNINGS_HEADING: 'Import warnings',
    SAVE_ERROR_FALLBACK: 'Could not save avatar catalogs.'
  },
  LOGS: {
    COLLAPSED: 'Logs',
    CLEAR: 'Clear logs',
    OPEN_FOLDER: 'Open log folder',
    // Phase 7 -- structured dispatch log prefix; styled green in
    // the LogsDrawer per UI-SPEC IP-4. 8-char prefix matches [READY]/[ERROR]
    // width-class for visual scan symmetry.
    DISPATCH_PREFIX: '[DISPATCH]'
  }
} as const
