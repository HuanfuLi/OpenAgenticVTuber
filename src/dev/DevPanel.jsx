/* DevPanel — feature-flagged in real builds. Drives every flow for review. */
const { mockStatus, mockBanners, mockToasts } = window.MOCK;

function DevPanel() {
  const [open, setOpen] = useState(false);
  const { status, banners, resetAll, setView, setChatMessages, showThreadList, setShowThreadList, setHistoryOpen } = useStore();
  const { prefs, setPrefs } = useTheme();

  // Theme cycler — list of all 7 with the prefs we'd set
  const themes = [
    { name: "Blush",     prefs: { mode: "light", lightAccent: "blush" } },
    { name: "Sunrise",   prefs: { mode: "light", lightAccent: "sunrise" } },
    { name: "Ember",     prefs: { mode: "light", lightAccent: "ember" } },
    { name: "Mid·Sky",   prefs: { mode: "dark", darkBg: "midnight", darkAccent: "sky" } },
    { name: "Mid·Pewter",prefs: { mode: "dark", darkBg: "midnight", darkAccent: "pewter" } },
    { name: "Onyx·Sky",  prefs: { mode: "dark", darkBg: "onyx", darkAccent: "sky" } },
    { name: "Onyx·Pewt", prefs: { mode: "dark", darkBg: "onyx", darkAccent: "pewter" } },
  ];

  const isActive = (t) => {
    if (t.prefs.mode !== prefs.mode) return false;
    if (t.prefs.mode === "light") return prefs.lightAccent === t.prefs.lightAccent;
    return prefs.darkBg === t.prefs.darkBg && prefs.darkAccent === t.prefs.darkAccent;
  };

  const cycle = (key, current) => {
    const seq = ["green", "amber", "red"];
    const i = seq.indexOf(current);
    return seq[(i + 1) % seq.length];
  };
  const setStatusFor = (key) => {
    const next = cycle(key, status[key]);
    const detailMap = {
      llm: { green: "qwen2.5-7b · LM Studio · last reply 423ms", amber: "reconnecting…", red: "Connection refused at http://localhost:1234/v1" },
      vts: { green: "rig=teto · @60Hz", amber: "handshake pending", red: "VTube Studio not running" },
      sidecar: { green: "ws://127.0.0.1:53811/ws · pid 21340", amber: "starting…", red: "exited code 137" },
    };
    mockStatus.set({ [key]: next, [`${key}Detail`]: detailMap[key][next] });
  };

  const triggerToast = (text) => {
    const id = Math.random().toString(36).slice(2);
    mockToasts.push({ id, text });
    setTimeout(() => mockToasts.remove(id), 4000);
  };

  if (!open) {
    return (
      <button className="dev-fab" onClick={() => setOpen(true)} title="Dev panel">🛠</button>
    );
  }

  return (
    <div className="dev-panel">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h4>Design-review panel</h4>
        <button className="dev-btn" onClick={() => setOpen(false)}>×</button>
      </div>

      <h4>Connection state</h4>
      <div className="dev-grid">
        <span>LLM</span>
        <button className={`dev-btn ${status.llm === "green" ? "active" : status.llm === "amber" ? "amber" : "red"}`} onClick={() => setStatusFor("llm")}>
          {status.llm}
        </button>
        <span>VTS</span>
        <button className={`dev-btn ${status.vts === "green" ? "active" : status.vts === "amber" ? "amber" : "red"}`} onClick={() => setStatusFor("vts")}>
          {status.vts}
        </button>
        <span>Sidecar</span>
        <button className={`dev-btn ${status.sidecar === "green" ? "active" : status.sidecar === "amber" ? "amber" : "red"}`} onClick={() => setStatusFor("sidecar")}>
          {status.sidecar}
        </button>
      </div>

      <h4>Trigger flows</h4>
      <div className="row">
        <button className="dev-btn" onClick={resetAll}>Reset cold launch</button>
        <button className="dev-btn" onClick={() => mockBanners.set({ llm: !banners.llm })}>Force LLM unreachable</button>
        <button className="dev-btn" onClick={() => mockBanners.set({ vts: !banners.vts })}>Force VTS disconnected</button>
        <button className="dev-btn" onClick={() => mockBanners.set({ vtsAuth: !banners.vtsAuth })}>Force VTS auth denied</button>
        <button className="dev-btn" onClick={() => { triggerToast(window.COPY.ERRORS.SIDECAR_TOAST); }}>Sidecar crash + restart</button>
        <button className="dev-btn" onClick={() => mockBanners.set({ tts: !banners.tts })}>Force TTS unavailable</button>
        <button className="dev-btn" onClick={() => { setView("chat"); window.dispatchEvent(new CustomEvent("chat:inject")); }}>Inject scripted convo</button>
        <button className="dev-btn" onClick={() => { setShowThreadList(!showThreadList); setHistoryOpen(true); }}>
          Toggle thread list ({showThreadList ? "v2 mock" : "empty"})
        </button>
      </div>

      <h4>Theme cycler</h4>
      <div className="row">
        {themes.map((t) => (
          <button key={t.name} className={`dev-btn${isActive(t) ? " active" : ""}`} onClick={() => setPrefs(t.prefs)}>
            {t.name}
          </button>
        ))}
      </div>
      <div className="row">
        <button className="dev-btn" onClick={() => setPrefs({ mode: "auto" })}>Mode: auto</button>
      </div>
    </div>
  );
}
window.DevPanel = DevPanel;
