/* SPEC §App shell — gates LLMSetup vs MainApp; wires Theme + Store; mounts DevPanel.
 * Implements USERFLOW Flow B (cold launch) and the always-on view-switch shell. */

function MainApp() {
  const { view, logsDrawer } = useStore();
  const [logLines, setLogLines] = useState([]);
  useEffect(() => {
    const onClear = () => setLogLines([]);
    window.addEventListener("logs:clear", onClear);
    return () => window.removeEventListener("logs:clear", onClear);
  }, []);
  // Single sidecar subscription owned by the view that displays the lines.
  // (Store-level subscription was duplicate dead code; removed there.)
  useEffect(() => {
    if (!logsDrawer.enabled) { setLogLines([]); return; }
    const stop = window.MOCK.startSidecarLogs((line) => setLogLines((c) => [...c, line].slice(-200)));
    return stop;
  }, [logsDrawer.enabled]);

  return (
    <div className="app-window">
      <div className="title-bar" data-theme-surface>
        <span className="dot" style={{ background: "#ff5f57" }} />
        <span className="dot" style={{ background: "#febc2e" }} />
        <span className="dot" style={{ background: "#28c840" }} />
        <span className="title">AgenticLLMVTuber</span>
      </div>
      <window.TopBar />
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", position: "relative" }}>
        {view === "chat" && <window.ChatView />}
        {view === "agent" && <window.AgentView />}
        {view === "settings" && <window.SettingsView />}
        <window.HistorySheet />
        <window.ToastStack />
      </div>
      <window.LogsDrawer logLines={logLines} />
      <window.BottomRail />
    </div>
  );
}

function GatedApp() {
  const { hasCompletedSetup } = useStore();
  return (
    <div className="app-window" style={{ background: "var(--background)" }}>
      <div className="title-bar" data-theme-surface>
        <span className="dot" style={{ background: "#ff5f57" }} />
        <span className="dot" style={{ background: "#febc2e" }} />
        <span className="dot" style={{ background: "#28c840" }} />
        <span className="title">AgenticLLMVTuber</span>
      </div>
      {hasCompletedSetup
        ? <MainApp key="main" />  /* MainApp re-mounts so transitions are clean post-setup */
        : <window.LLMSetup />}
    </div>
  );
}

function App() {
  return (
    <window.ThemeProvider>
      <window.AppStoreProvider>
        <div className="viewport">
          {/* Single window centered; GatedApp drives setup vs main */}
          <GatedAppShell />
        </div>
        <window.DevPanel />
      </window.AppStoreProvider>
    </window.ThemeProvider>
  );
}

// Wrapper that picks setup vs main without double-rendering window chrome
function GatedAppShell() {
  const { hasCompletedSetup } = useStore();
  if (!hasCompletedSetup) {
    return (
      <div className="app-window">
        <div className="title-bar" data-theme-surface>
          <span className="dot" style={{ background: "#ff5f57" }} />
          <span className="dot" style={{ background: "#febc2e" }} />
          <span className="dot" style={{ background: "#28c840" }} />
          <span className="title">AgenticLLMVTuber · setup</span>
        </div>
        <window.LLMSetup />
      </div>
    );
  }
  return <MainApp />;
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
