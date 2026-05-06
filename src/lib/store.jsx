/* SPEC §Color resolution + §State machine — single store + ThemeProvider.
 * - resolveThemeClass: maps preferences + prefers-color-scheme to one of 7 classes
 * - ThemeProvider: applies class to <html>; subscribes to OS dark-mode changes
 * - AppStore: top-level UI state — view, hasCompletedSetup, history sheet, etc.
 */
const { useState, useEffect, useMemo, useCallback, useRef, createContext, useContext } = React;
const { mockSafeStorage, mockStatus, mockBanners, mockToasts, startSidecarLogs, worstOf } = window.MOCK;

const DEFAULT_PREFS = {
  mode: "auto",
  lightAccent: "blush",
  darkBg: "midnight",
  darkAccent: "sky",
};

function resolveThemeClass(p, prefersDark) {
  // Hardening: fall back to defaults if any field is missing/invalid
  const lightAccent = ["blush", "sunrise", "ember"].includes(p.lightAccent) ? p.lightAccent : "blush";
  const darkBg = ["midnight", "onyx"].includes(p.darkBg) ? p.darkBg : "midnight";
  const darkAccent = ["sky", "pewter"].includes(p.darkAccent) ? p.darkAccent : "sky";
  const resolvedMode = p.mode === "auto" ? (prefersDark ? "dark" : "light") : p.mode;
  if (resolvedMode === "light") return `theme-${lightAccent}`;
  return `theme-${darkBg}-${darkAccent}`;
}
window.resolveThemeClass = resolveThemeClass;

// ---------------- ThemeProvider ----------------
const ThemeContext = createContext(null);

function ThemeProvider({ children }) {
  const stored = mockSafeStorage.get("themePreference");
  const [prefs, setPrefsState] = useState(stored || DEFAULT_PREFS);
  const [prefersDark, setPrefersDark] = useState(() =>
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false
  );

  // Listen for OS theme changes (only meaningful when mode === "auto")
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => setPrefersDark(e.matches);
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  const themeClass = useMemo(() => resolveThemeClass(prefs, prefersDark), [prefs, prefersDark]);

  // Apply to <html>
  useEffect(() => {
    document.documentElement.className = themeClass;
  }, [themeClass]);

  const setPrefs = useCallback((patch) => {
    setPrefsState((cur) => {
      const next = typeof patch === "function" ? patch(cur) : { ...cur, ...patch };
      mockSafeStorage.set("themePreference", next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ prefs, setPrefs, themeClass, prefersDark }), [prefs, setPrefs, themeClass, prefersDark]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
function useTheme() { return useContext(ThemeContext); }

// ---------------- AppStore ----------------
const AppStoreContext = createContext(null);

function AppStoreProvider({ children }) {
  // safeStorage-hydrated values
  const initialSetup = mockSafeStorage.get("hasCompletedSetup") === true;
  const initialConn = mockSafeStorage.get("llmConfig") || {
    provider: "lmstudio",
    endpoint: "http://localhost:1234/v1",
    model: "",
    apiKey: "",
  };
  // Default OFF; persisted state is layered on top but enabled is force-defaulted off on every fresh load
  const persistedLogs = mockSafeStorage.get("logsDrawer") || {};
  const initialLogs = { enabled: false, open: false, height: 200, ...persistedLogs, enabled: false };

  const [hasCompletedSetup, setHasCompletedSetup] = useState(initialSetup);
  const [llmConfig, setLlmConfigState] = useState(initialConn);
  const [view, setView] = useState("chat"); // chat | agent | settings
  const [historyOpen, setHistoryOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [agentToggle, setAgentToggle] = useState(false);
  const [logsDrawer, setLogsDrawerState] = useState(initialLogs);
  const [showThreadList, setShowThreadList] = useState(false); // dev panel toggle for History
  const [chatMessages, setChatMessages] = useState([]);

  // Status (subscribe to mock)
  const [status, setStatus] = useState(mockStatus.get());
  useEffect(() => mockStatus.subscribe(setStatus), []);

  // Banners
  const [banners, setBanners] = useState({ llm: false, vts: false, vtsAuth: false, sidecarRepeat: false, tts: false });
  useEffect(() => mockBanners.subscribe(setBanners), []);

  // Toasts
  const [toasts, setToasts] = useState([]);
  useEffect(() => mockToasts.subscribe((evt) => {
    if (evt.kind === "add") setToasts((t) => [...t, { id: evt.id, text: evt.text }]);
    else if (evt.kind === "remove") setToasts((t) => t.filter((x) => x.id !== evt.id));
  }), []);

  // (Sidecar log subscription owned by MainApp — it renders the drawer.)

  const setLlmConfig = useCallback((cfg) => {
    setLlmConfigState(cfg);
    mockSafeStorage.set("llmConfig", cfg);
  }, []);
  const setLogsDrawer = useCallback((patch) => {
    setLogsDrawerState((cur) => {
      const next = typeof patch === "function" ? patch(cur) : { ...cur, ...patch };
      mockSafeStorage.set("logsDrawer", next);
      return next;
    });
  }, []);

  const completeSetup = useCallback((cfg) => {
    setLlmConfig(cfg);
    mockSafeStorage.set("hasCompletedSetup", true);
    setHasCompletedSetup(true);
  }, [setLlmConfig]);

  const resetAll = useCallback(() => {
    mockSafeStorage.clear();
    setHasCompletedSetup(false);
    setLlmConfigState({ provider: "lmstudio", endpoint: "http://localhost:1234/v1", model: "", apiKey: "" });
    setView("chat");
    setHistoryOpen(false);
    setStatusOpen(false);
    setAgentToggle(false);
    setLogsDrawerState({ enabled: false, open: false, height: 200 });
    setChatMessages([]);
  }, []);

  const value = useMemo(() => ({
    hasCompletedSetup, completeSetup,
    llmConfig, setLlmConfig,
    view, setView,
    historyOpen, setHistoryOpen,
    statusOpen, setStatusOpen,
    agentToggle, setAgentToggle,
    logsDrawer, setLogsDrawer,
    showThreadList, setShowThreadList,
    chatMessages, setChatMessages,
    status, statusOverall: worstOf(status),
    banners,
    toasts,
    resetAll,
  }), [hasCompletedSetup, llmConfig, view, historyOpen, statusOpen, agentToggle, logsDrawer, showThreadList, chatMessages, status, banners, toasts, completeSetup, setLlmConfig, setLogsDrawer, resetAll]);

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}
function useStore() { return useContext(AppStoreContext); }

window.ThemeProvider = ThemeProvider;
window.useTheme = useTheme;
window.AppStoreProvider = AppStoreProvider;
window.useStore = useStore;
