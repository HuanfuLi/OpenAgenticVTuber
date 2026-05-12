/* SPEC §3 Chrome + USERFLOW Flows C/D/F/G/I/K/L. */
const { mockEcho, mockStatus, SCRIPTED_CONVO, PLACEHOLDER_THREADS, mockBanners, mockToasts } = window.MOCK;

// -------------------- StatusIcon --------------------
function StatusIcon() {
  const { status, statusOpen, setStatusOpen, statusOverall } = useStore();
  const { Hexagon } = window.ICONS;

  const popoverRef = useRef(null);
  useEffect(() => {
    if (!statusOpen) return;
    const onDoc = (e) => {
      if (!popoverRef.current) return;
      if (!popoverRef.current.contains(e.target) && !e.target.closest(".status-hex-btn")) setStatusOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setStatusOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [statusOpen, setStatusOpen]);

  const color = statusOverall === "green" ? "var(--success)" : statusOverall === "amber" ? "var(--warning)" : "var(--destructive)";

  const [retesting, setRetesting] = useState(false);
  const onRetest = async () => {
    setRetesting(true);
    // Cycle a quick test
    mockStatus.set({ llm: "amber", llmDetail: "reconnecting…" });
    await new Promise((r) => setTimeout(r, 600));
    mockStatus.set({ llm: "green", llmDetail: "qwen2.5-7b · LM Studio · last reply 423ms" });
    setRetesting(false);
  };

  return (
    <div className="relative" style={{ display: "inline-flex" }}>
      <button
        className="icon-btn status-hex-btn"
        title={`Status: ${statusOverall}`}
        aria-label={`${window.COPY.STATUS.HEADER}: ${statusOverall}`}
        onClick={() => setStatusOpen(!statusOpen)}
      >
        <span className="status-hex" style={{ color }}>
          <Hexagon size={18} fill={color} strokeWidth={1.25} />
        </span>
      </button>
      {statusOpen && (
        <div className="popover" ref={popoverRef} role="dialog" data-theme-surface>
          <div className="head"><h3>{window.COPY.STATUS.HEADER}</h3></div>
          <div className="row">
            <span className={`dot ${status.llm === "green" ? "green" : status.llm === "amber" ? "amber" : "red"}`} />
            <span className="label">{window.COPY.STATUS.LLM}</span>
            <span className="detail">{status.llmDetail}</span>
          </div>
          <div className="row">
            <span className={`dot ${status.vts === "green" ? "green" : status.vts === "amber" ? "amber" : "red"}`} />
            <span className="label">{window.COPY.STATUS.VTS}</span>
            <span className="detail">{status.vtsDetail}</span>
          </div>
          <div className="row">
            <span className={`dot ${status.sidecar === "green" ? "green" : status.sidecar === "amber" ? "amber" : "red"}`} />
            <span className="label">{window.COPY.STATUS.SIDECAR}</span>
            <span className="detail">{status.sidecarDetail}</span>
          </div>
          <button className="btn btn-primary" disabled={retesting} onClick={onRetest} style={{ marginTop: 4 }}>
            {retesting ? window.COPY.STATUS.TESTING : window.COPY.STATUS.RETEST}
          </button>
        </div>
      )}
    </div>
  );
}

// -------------------- TopBar --------------------
function TopBar() {
  const { view, historyOpen, setHistoryOpen, agentToggle, setAgentToggle } = useStore();
  const { Menu, Wand2 } = window.ICONS;
  const showHamburger = view === "chat";
  return (
    <div className="top-bar" data-theme-surface>
      {showHamburger ? (
        <button className="icon-btn" aria-label="History" aria-expanded={historyOpen} onClick={() => setHistoryOpen(!historyOpen)}>
          <Menu size={18} />
        </button>
      ) : (
        <span className="icon-slot" aria-hidden="true" />
      )}
      <button
        className={`agent-toggle${agentToggle ? " on" : ""} tt`}
        data-tt={agentToggle ? "" : window.COPY.AGENT.TOGGLE_DISABLED_TT}
        onClick={() => setAgentToggle(!agentToggle)}
      >
        <Wand2 size={14} />
        <span>Agent</span>
      </button>
      <span className="spacer" />
      <StatusIcon />
    </div>
  );
}

// -------------------- BottomRail --------------------
function BottomRail() {
  const { view, setView } = useStore();
  const { MessageSquare, Wand2, Settings } = window.ICONS;
  const tabs = [
    { id: "chat", label: "Chat", Icon: MessageSquare },
    { id: "agent", label: "Agent", Icon: Wand2 },
    { id: "settings", label: "Settings", Icon: Settings },
  ];
  return (
    <div className="bottom-rail" data-theme-surface>
      {tabs.map(({ id, label, Icon }) => {
        const active = view === id;
        return (
          <button
            key={id}
            className={`rail-tab${active ? " active" : ""}`}
            onClick={() => setView(id)}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={20} fill={active ? "currentColor" : "none"} strokeWidth={active ? 1.5 : 1.75} />
            <span className="label">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

// -------------------- HistorySheet --------------------
function HistorySheet() {
  const { historyOpen, setHistoryOpen, showThreadList, setChatMessages } = useStore();
  const { X, Plus, Search } = window.ICONS;

  useEffect(() => {
    if (!historyOpen) return;
    const onKey = (e) => { if (e.key === "Escape") setHistoryOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [historyOpen, setHistoryOpen]);

  if (!historyOpen) return null;

  return (
    <div className="sheet-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setHistoryOpen(false); }}>
      <div className="sheet" data-theme-surface role="dialog" aria-label={window.COPY.HISTORY.HEADER}>
        <div className="head">
          <h3>{window.COPY.HISTORY.HEADER}</h3>
          <button className="icon-btn" aria-label="Close" onClick={() => setHistoryOpen(false)}><X size={16} /></button>
        </div>

        <div className="input" style={{ display: "flex", alignItems: "center", gap: 8, opacity: showThreadList ? 1 : 0.5, cursor: showThreadList ? "text" : "not-allowed" }}>
          <Search size={14} />
          <span style={{ color: "var(--muted-foreground)", fontSize: 14 }}>{window.COPY.HISTORY.SEARCH}</span>
        </div>

        {showThreadList ? (
          <div className="grow" style={{ overflow: "auto" }}>
            {Object.entries(PLACEHOLDER_THREADS).map(([group, threads]) => (
              <div key={group}>
                <div className="group-title">{group}</div>
                {threads.map((t, i) => (
                  <div key={i} className="thread-row" onClick={() => setHistoryOpen(false)}>· {t.title}</div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state grow">
            <h2>{window.COPY.HISTORY.PLACEHOLDER_HEAD}</h2>
            <p>{window.COPY.HISTORY.PLACEHOLDER_BODY}</p>
          </div>
        )}

        <button className="btn btn-secondary" onClick={() => { setChatMessages([]); setHistoryOpen(false); }}>
          <Plus size={14} /> {window.COPY.HISTORY.NEW_THREAD.replace("+ ", "")}
        </button>
      </div>
      <div className="sheet-grab" onClick={() => setHistoryOpen(false)} />
    </div>
  );
}

// -------------------- LogsDrawer --------------------
function LogsDrawer({ logLines }) {
  const { logsDrawer, setLogsDrawer } = useStore();
  const { ChevronUp, ChevronDown, Folder } = window.ICONS;

  const dragRef = useRef({ active: false, startY: 0, startH: 200 });
  const onMouseDown = (e) => {
    dragRef.current = { active: true, startY: e.clientY, startH: logsDrawer.height || 200 };
    e.preventDefault();
  };
  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current.active) return;
      const dy = dragRef.current.startY - e.clientY;
      const next = Math.max(80, Math.min(500, dragRef.current.startH + dy));
      setLogsDrawer({ height: next });
    };
    const onUp = () => { dragRef.current.active = false; };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
  }, [setLogsDrawer]);

  if (!logsDrawer.enabled) return null;

  if (!logsDrawer.open) {
    return (
      <div className="logs-strip" data-theme-surface onClick={() => setLogsDrawer({ open: true })}>
        <span>{window.COPY.LOGS.COLLAPSED}</span>
        <ChevronUp size={14} />
      </div>
    );
  }

  return (
    <div className="logs-drawer" data-theme-surface style={{ height: logsDrawer.height || 200 }}>
      <div className="grab" onMouseDown={onMouseDown} />
      <div className="header">
        <button className="btn btn-ghost" style={{ height: 24, padding: "0 6px" }} onClick={() => setLogsDrawer({ open: false })}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{window.COPY.LOGS.COLLAPSED}</span>
          <ChevronDown size={14} />
        </button>
        <div style={{ display: "flex", gap: 4 }}>
          <button className="btn btn-ghost" style={{ height: 24, padding: "0 8px", fontSize: 12 }}
            onClick={(e) => { e.stopPropagation(); /* clear handled by parent */ window.dispatchEvent(new CustomEvent("logs:clear")); }}>
            {window.COPY.LOGS.CLEAR}
          </button>
          <button className="btn btn-ghost" style={{ height: 24, padding: "0 8px", fontSize: 12 }}
            onClick={(e) => { e.stopPropagation(); alert(`(mock) Would open: ~/Library/Logs/AgenticLLMVTuber`); }}>
            <Folder size={12} /> {window.COPY.LOGS.OPEN_FOLDER}
          </button>
        </div>
      </div>
      <div className="body">
        {logLines.map((line, i) => <div key={i} className="line">{line}</div>)}
      </div>
    </div>
  );
}

// -------------------- ChatView --------------------
function ChatView() {
  const { status, banners, chatMessages, setChatMessages } = useStore();
  const { ExternalLink, Send } = window.ICONS;
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  // Inject scripted convo via window event from dev panel
  useEffect(() => {
    const onInject = () => setChatMessages(SCRIPTED_CONVO.map((m, i) => ({ id: Date.now() + i, ...m })));
    window.addEventListener("chat:inject", onInject);
    return () => window.removeEventListener("chat:inject", onInject);
  }, [setChatMessages]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chatMessages.length, sending]);

  const onSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    if (banners.llm) return; // disabled by banner
    setInput("");
    setSending(true);
    const userMsg = { id: Date.now(), role: "user", text };
    setChatMessages((m) => [...m, userMsg]);
    const reply = await mockEcho(text, 200);
    setChatMessages((m) => [...m, { id: Date.now() + 1, role: "assistant", text: reply }]);
    setSending(false);
  };

  // Empty-state logic per SPEC: VTS not connected vs ready
  const empty = chatMessages.length === 0;
  const vtsReady = status.vts === "green";
  const inputDisabled = banners.llm; // sidecar repeat banner also disables in spec; both treat similarly

  return (
    <div className="view">
      <div className="chat-scroll" ref={scrollRef}>
        {empty ? (
          vtsReady ? (
            <div className="empty-state">
              <h2>{window.COPY.CHAT.EMPTY_READY_HEAD}</h2>
              <p>{window.COPY.CHAT.EMPTY_READY_BODY}</p>
              <p className="footer-cap">{window.COPY.CHAT.EMPTY_READY_FOOTER}</p>
            </div>
          ) : (
            <div className="empty-state">
              <h2>{window.COPY.CHAT.EMPTY_VTS_HEAD}</h2>
              <p>{window.COPY.CHAT.EMPTY_VTS_BODY}</p>
              <button className="btn btn-link" onClick={() => alert("(mock) Would open: VTube Studio docs")}>
                {window.COPY.CHAT.EMPTY_VTS_LINK}
              </button>
            </div>
          )
        ) : (
          chatMessages.map((m) => {
            const ts = new Date(m.id).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            return (
              <div key={m.id} className={`bubble ${m.role}`}>
                <div className="meta">
                  <span className="semibold">{m.role === "user" ? "You" : "Teto"}</span>
                  <span>{ts}</span>
                </div>
                <div className="body">{m.text}</div>
              </div>
            );
          })
        )}
        {sending && (
          <div className="bubble assistant">
            <div className="meta"><span className="semibold">Teto</span><span>…</span></div>
            <div className="body muted">…</div>
          </div>
        )}
      </div>

      {/* Banners (above input row) */}
      {banners.llm && (
        <div className="banner">⚠ {window.COPY.ERRORS.LLM_UNREACHABLE_BANNER}
          <button className="btn btn-secondary" style={{ height: 26, padding: "0 10px", fontSize: 12 }}
            onClick={() => mockBanners.set({ llm: false })}>Retry</button>
        </div>
      )}
      {banners.vts && <div className="banner warn">{window.COPY.ERRORS.VTS_DISCONNECTED}</div>}
      {banners.vtsAuth && (
        <div className="banner warn">{window.COPY.ERRORS.VTS_AUTH_DENIED}
          <button className="btn btn-secondary" style={{ height: 26, padding: "0 10px", fontSize: 12 }}
            onClick={() => mockBanners.set({ vtsAuth: false })}>Re-request</button>
        </div>
      )}
      {banners.sidecarRepeat && (
        <div className="banner">{window.COPY.ERRORS.SIDECAR_REPEAT}
          <button className="btn btn-secondary" style={{ height: 26, padding: "0 10px", fontSize: 12 }}
            onClick={() => mockBanners.set({ sidecarRepeat: false })}>Restart sidecar</button>
        </div>
      )}
      {banners.tts && <div className="banner warn">{window.COPY.ERRORS.TTS_UNAVAILABLE}</div>}

      <div className="input-row">
        <input
          className="input"
          placeholder={window.COPY.CHAT.INPUT_PLACEHOLDER}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          disabled={inputDisabled}
        />
        <button className="send" onClick={onSend} disabled={!input.trim() || sending || inputDisabled} aria-label="Send">
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

// -------------------- AgentView --------------------
function AgentView() {
  return (
    <div className="view">
      <div className="empty-state grow">
        <h2>{window.COPY.AGENT.PLACEHOLDER_HEAD}</h2>
        <p style={{ maxWidth: 320 }}>{window.COPY.AGENT.PLACEHOLDER_BODY}</p>
      </div>
    </div>
  );
}

// -------------------- ToastStack --------------------
function ToastStack() {
  const { toasts } = useStore();
  if (!toasts.length) return null;
  return (
    <div className="toast-stack">
      {toasts.map((t) => <div key={t.id} className="toast" data-theme-surface>{t.text}</div>)}
    </div>
  );
}

window.TopBar = TopBar;
window.BottomRail = BottomRail;
window.HistorySheet = HistorySheet;
window.LogsDrawer = LogsDrawer;
window.ChatView = ChatView;
window.AgentView = AgentView;
window.ToastStack = ToastStack;
window.StatusIcon = StatusIcon;
