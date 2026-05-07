// SPEC §Copywriting Contract — every user-visible string lives here.
// Ported verbatim from prototype src/lib/copy.js (2026-05-06). Typed `as const`.

export const COPY = {
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
      { num: 5, title: 'TTS / Voice out', milestone: 3, body: 'Switch between piper, edge-tts, GPT-SoVITS, and ComfyUI; pick voices and output devices.' },
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
  LOGS: {
    COLLAPSED: 'Logs',
    CLEAR: 'Clear logs',
    OPEN_FOLDER: 'Open log folder',
    // Phase 2 (plan 02-03) -- structured intent log prefix; styled green in
    // the LogsDrawer per UI-SPEC IP-4. 8-char prefix matches [READY]/[ERROR]
    // width-class for visual scan symmetry.
    INTENT_PREFIX: '[INTENT]'
  }
} as const
