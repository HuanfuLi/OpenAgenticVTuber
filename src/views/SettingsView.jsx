/* SPEC §Settings IA + §14 Appearance + §15 Diagnostics + §16 About + USERFLOW J. */

// Resolve the swatch *color* a given option would produce.
function lightAccentSwatchColor(id) {
  if (id === "blush")   return "oklch(0.72 0.10 15)";
  if (id === "sunrise") return "oklch(0.72 0.12 55)";
  if (id === "ember")   return "oklch(0.62 0.13 25)";
  return "transparent";
}
function darkBgSwatchColor(id) {
  if (id === "midnight") return "oklch(0.20 0.035 250)";
  if (id === "onyx")     return "oklch(0.17 0.005 270)";
  return "transparent";
}
function darkAccentSwatchColor(id) {
  if (id === "sky")    return "oklch(0.78 0.08 240)";
  if (id === "pewter") return "oklch(0.75 0.005 270)";
  return "transparent";
}

// Generic radio-row used in Appearance
function RadioRow({ id, name, label, isDefault, checked, disabled, onChange, swatch, swatchSquare, tooltip }) {
  return (
    <div
      role="radio"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      className={`radio-row${checked ? " checked" : ""}${disabled ? " disabled" : ""}${tooltip ? " tt" : ""}`}
      data-tt={tooltip || undefined}
      style={disabled ? { cursor: "not-allowed" } : {}}
      onClick={() => { if (!disabled) onChange(id); }}
      onKeyDown={(e) => { if (!disabled && (e.key === " " || e.key === "Enter")) { e.preventDefault(); onChange(id); } }}
    >
      <span className="dotwrap"><span className="inner" /></span>
      <span style={{ flex: 1 }}>{label}</span>
      {swatch && <span className={`swatch${swatchSquare ? " square" : ""}`} style={{ background: swatch }} />}
      {isDefault && <span className="default-tag">(default)</span>}
    </div>
  );
}

// Live preview of current resolved theme
function AppearancePreview() {
  const { status } = useStore();
  return (
    <div className="preview-card" data-theme-surface>
      <div className="row">
        <span className="semibold tx-sm">Teto</span>
        <span className="tx-sm muted">10:42</span>
      </div>
      <div className="bubble assistant" style={{ alignSelf: "flex-start" }}>
        <div className="body">On a quiet afternoon, the cat noticed a glint beneath the bookshelf.</div>
      </div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <button className="btn btn-primary" style={{ height: 32, padding: "0 12px", fontSize: 13 }}>Test connection</button>
        <div className="row">
          <span className="dot green" />
          <span className="dot amber" />
          <span className="dot red" />
        </div>
      </div>
    </div>
  );
}

// Appearance §14 — fully functional
function AppearanceSection() {
  const COPY = window.COPY.SETTINGS;
  const { prefs, setPrefs, prefersDark } = useTheme();

  const resolvedMode = prefs.mode === "auto" ? (prefersDark ? "dark" : "light") : prefs.mode;
  const lightDisabled = prefs.mode === "dark";
  const darkDisabled = prefs.mode === "light";

  return (
    <section className="section" id="sec-appearance">
      <h2>{COPY.APPEARANCE_HEADER}</h2>

      <div className="group-label">{COPY.MODE_LABEL}</div>
      <div className="radio-group" role="radiogroup" aria-label={COPY.MODE_LABEL}>
        {COPY.MODE_OPTIONS.map((o) => (
          <RadioRow
            key={o.id} id={o.id} name="mode"
            label={o.label}
            isDefault={o.isDefault}
            checked={prefs.mode === o.id}
            onChange={(id) => setPrefs({ mode: id })}
          />
        ))}
      </div>

      <div className="group-label">{COPY.LIGHT_ACCENT_LABEL}</div>
      <div className="group-help">{COPY.LIGHT_ACCENT_HELP}</div>
      <div className="radio-group" role="radiogroup" aria-label={COPY.LIGHT_ACCENT_LABEL} aria-disabled={lightDisabled}>
        {COPY.LIGHT_ACCENT_OPTIONS.map((o) => (
          <RadioRow
            key={o.id} id={o.id} name="lightAccent"
            label={o.label}
            isDefault={o.isDefault}
            checked={prefs.lightAccent === o.id}
            disabled={lightDisabled}
            onChange={(id) => setPrefs({ lightAccent: id })}
            swatch={lightAccentSwatchColor(o.id)}
            tooltip={lightDisabled ? COPY.DISABLED_LIGHT_TT : null}
          />
        ))}
      </div>

      <div className="group-label">{COPY.DARK_BG_LABEL}</div>
      <div className="group-help">{COPY.DARK_BG_HELP}</div>
      <div className="radio-group" role="radiogroup" aria-label={COPY.DARK_BG_LABEL} aria-disabled={darkDisabled}>
        {COPY.DARK_BG_OPTIONS.map((o) => (
          <RadioRow
            key={o.id} id={o.id} name="darkBg"
            label={o.label}
            isDefault={o.isDefault}
            checked={prefs.darkBg === o.id}
            disabled={darkDisabled}
            onChange={(id) => setPrefs({ darkBg: id })}
            swatch={darkBgSwatchColor(o.id)}
            swatchSquare
            tooltip={darkDisabled ? COPY.DISABLED_DARK_TT : null}
          />
        ))}
      </div>

      <div className="group-label">{COPY.DARK_ACCENT_LABEL}</div>
      <div className="group-help">{COPY.DARK_ACCENT_HELP}</div>
      <div className="radio-group" role="radiogroup" aria-label={COPY.DARK_ACCENT_LABEL} aria-disabled={darkDisabled}>
        {COPY.DARK_ACCENT_OPTIONS.map((o) => (
          <RadioRow
            key={o.id} id={o.id} name="darkAccent"
            label={o.label}
            isDefault={o.isDefault}
            checked={prefs.darkAccent === o.id}
            disabled={darkDisabled}
            onChange={(id) => setPrefs({ darkAccent: id })}
            swatch={darkAccentSwatchColor(o.id)}
            tooltip={darkDisabled ? COPY.DISABLED_DARK_TT : null}
          />
        ))}
      </div>

      <div className="group-label mt-4">{COPY.PREVIEW_HEADER}</div>
      <AppearancePreview />
    </section>
  );
}

// Connection (functional)
function ConnectionSection() {
  const COPY = window.COPY.SETTINGS;
  const { llmConfig } = useStore();
  const [retesting, setRetesting] = useState(false);
  const onRetest = async () => {
    setRetesting(true);
    mockStatus.set({ llm: "amber", llmDetail: "reconnecting…" });
    await new Promise((r) => setTimeout(r, 600));
    mockStatus.set({ llm: "green", llmDetail: "qwen2.5-7b · LM Studio · last reply 423ms" });
    setRetesting(false);
  };
  return (
    <section className="section" id="sec-connection">
      <h2>{COPY.CONN_HEADER}</h2>
      <div className="kv-row"><span className="k">Provider</span><span className="v">{llmConfig.provider === "lmstudio" ? "LM Studio" : llmConfig.provider}</span></div>
      <div className="kv-row"><span className="k">Endpoint</span><span className="v">{llmConfig.endpoint}</span></div>
      <div className="kv-row"><span className="k">Model</span><span className="v">{llmConfig.model || "auto-detect"}</span></div>
      <div className="row mt-2" style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-secondary" onClick={onRetest} disabled={retesting}>{retesting ? window.COPY.STATUS.TESTING : COPY.CONN_RETEST}</button>
        <span className="tt" data-tt={COPY.CONN_CHANGE_DISABLED_TT} style={{ display: "inline-flex" }}>
          <button className="btn btn-secondary" disabled style={{ pointerEvents: "none" }}>{COPY.CONN_CHANGE}</button>
        </span>
      </div>
    </section>
  );
}

// Diagnostics (partial-functional)
function DiagnosticsSection({ onResetClick }) {
  const COPY = window.COPY.SETTINGS;
  const { logsDrawer, setLogsDrawer } = useStore();
  const { Folder } = window.ICONS;
  return (
    <section className="section" id="sec-diagnostics">
      <h2>{COPY.DIAG_HEADER}</h2>
      <div className="kv-row" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="v">{COPY.DIAG_SHOW_LOGS}</div>
          <div className="tx-sm muted" style={{ marginTop: 2 }}>{COPY.DIAG_SHOW_LOGS_HINT}</div>
        </div>
        <button
          className={`switch${logsDrawer.enabled ? " on" : ""}`}
          aria-label={COPY.DIAG_SHOW_LOGS}
          aria-checked={logsDrawer.enabled}
          role="switch"
          onClick={() => setLogsDrawer({ enabled: !logsDrawer.enabled, open: !logsDrawer.enabled ? true : logsDrawer.open })}
        />
      </div>

      <div className="kv-row" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="v">{COPY.DIAG_LOG_LEVEL}</div>
          <div className="tx-sm muted" style={{ marginTop: 2 }}>{COPY.DIAG_LOG_LEVEL_HELP}</div>
        </div>
        <select className="select" disabled style={{ width: 120 }} value="info" onChange={() => {}}>
          <option>info</option>
        </select>
      </div>

      <div className="kv-row" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="v">{COPY.DIAG_TELEMETRY}</div>
          <div className="tx-sm muted" style={{ marginTop: 2 }}>{COPY.DIAG_TELEMETRY_HELP}</div>
        </div>
        <button className="switch" aria-label={COPY.DIAG_TELEMETRY} disabled />
      </div>

      <div className="row mt-4" style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-secondary" onClick={() => alert("(mock) Would open: ~/Library/Logs/AgenticLLMVTuber")}>
          <Folder size={14} /> {COPY.DIAG_OPEN_FOLDER}
        </button>
        <button className="btn btn-destructive" onClick={onResetClick}>{COPY.DIAG_RESET}</button>
      </div>
    </section>
  );
}

// About (functional)
function AboutSection() {
  const COPY = window.COPY.SETTINGS;
  return (
    <section className="section" id="sec-about">
      <h2>{COPY.ABOUT_HEADER}</h2>
      <div className="kv-row"><span className="k">{COPY.ABOUT_VERSION}</span><span className="v mono">{COPY.ABOUT_VERSION_VAL}</span></div>
      <div className="kv-row" style={{ alignItems: "flex-start" }}>
        <span className="k">{COPY.ABOUT_CHANNEL}</span>
        <span className="v muted tx-sm">{COPY.ABOUT_CHANNEL_VAL}</span>
      </div>
      <div className="kv-row"><span className="k">Links</span><span className="v">{COPY.ABOUT_LINKS}</span></div>
    </section>
  );
}

// Generic placeholder (§2-§13)
function PlaceholderSection({ num, title, milestone, body }) {
  return (
    <section className="section" id={`sec-${num}`}>
      <h2>{title}</h2>
      <div className="placeholder-line muted">Coming in milestone-{milestone}. {body}</div>
    </section>
  );
}

// Reset dialog
function ResetDialog({ open, onCancel, onConfirm }) {
  if (!open) return null;
  const COPY = window.COPY.RESET;
  return (
    <div className="dialog-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="dialog" data-theme-surface role="alertdialog" aria-labelledby="reset-title">
        <h3 id="reset-title">{COPY.TITLE}</h3>
        <p>{COPY.BODY}</p>
        <div className="actions">
          <button className="btn btn-secondary" onClick={onCancel}>{COPY.CANCEL}</button>
          <button className="btn btn-destructive" onClick={onConfirm}>{COPY.CONFIRM}</button>
        </div>
      </div>
    </div>
  );
}

// Settings view
function SettingsView() {
  const COPY = window.COPY.SETTINGS;
  const { resetAll } = useStore();
  const [resetOpen, setResetOpen] = useState(false);
  const scrollRef = useRef(null);

  // Anchor pills — reset scroll on enter
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, []);

  const anchors = [
    { id: "sec-connection", label: "Connection" },
    { id: "sec-2", label: "Avatars" },
    { id: "sec-4", label: "VTube Studio" },
    { id: "sec-appearance", label: "Appearance" },
    { id: "sec-diagnostics", label: "Diagnostics" },
    { id: "sec-about", label: "About" },
  ];

  // Track active section
  const [activeAnchor, setActiveAnchor] = useState("sec-connection");
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const onScroll = () => {
      const y = root.scrollTop + 24;
      let best = anchors[0].id;
      for (const a of anchors) {
        const el = root.querySelector(`#${a.id}`);
        if (el && el.offsetTop <= y) best = a.id;
      }
      setActiveAnchor(best);
    };
    root.addEventListener("scroll", onScroll);
    return () => root.removeEventListener("scroll", onScroll);
  }, []);

  const goTo = (id) => {
    const root = scrollRef.current;
    if (!root) return;
    const el = root.querySelector(`#${id}`);
    if (el) root.scrollTo({ top: el.offsetTop - 8, behavior: "smooth" });
  };

  return (
    <div className="view">
      <div className="settings-scroll" ref={scrollRef}>
        <h1>{COPY.HEADER}</h1>
        <div className="anchor-pills">
          {anchors.map((a) => (
            <button key={a.id} className={`anchor-pill${activeAnchor === a.id ? " active" : ""}`} onClick={() => goTo(a.id)}>
              {a.label}
            </button>
          ))}
        </div>

        <ConnectionSection />

        {COPY.PLACEHOLDERS.slice(0, 12).map((p) => (
          <PlaceholderSection key={p.num} num={p.num} title={p.title} milestone={p.milestone} body={p.body} />
        ))}

        <AppearanceSection />
        <DiagnosticsSection onResetClick={() => setResetOpen(true)} />
        <AboutSection />
      </div>
      <ResetDialog
        open={resetOpen}
        onCancel={() => setResetOpen(false)}
        onConfirm={() => { resetAll(); setResetOpen(false); }}
      />
    </div>
  );
}

window.SettingsView = SettingsView;
