// SPEC §Mock backend — single source of mocked IPC/safeStorage/network.
// All of these are pure-browser shims; there's no real network / Electron.

(function () {
  // ---------------- mockSafeStorage ----------------
  const LS_KEY = "alvtuber_mock_safestorage_v1";
  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return {};
      return JSON.parse(raw);
    } catch (e) {
      return {};
    }
  }
  function save(data) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch (e) {}
  }
  const mockSafeStorage = {
    get(key) { const d = load(); return d[key]; },
    set(key, value) { const d = load(); d[key] = value; save(d); },
    delete(key) { const d = load(); delete d[key]; save(d); },
    clear() { localStorage.removeItem(LS_KEY); },
  };

  // ---------------- mockEcho ----------------
  function mockEcho(text, delayMs = 200) {
    return new Promise((resolve) => {
      setTimeout(() => resolve(`echo: ${text}`), delayMs);
    });
  }

  // ---------------- mockTestConnection ----------------
  // Yields verbose log lines per SPEC. forceFail: 'refused'|'no-model'|'auth'|'404'|null
  async function* mockTestConnection(provider, endpoint, apiKey, model, opts = {}) {
    const forceFail = opts.fail === true ? "refused" : opts.forceFail || null;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    yield { kind: "info", text: `▸ Resolving endpoint ${endpoint || "(empty)"} ...` };
    await sleep(100);

    if (forceFail === "refused") {
      yield { kind: "error", text: `✕ Connection refused at 127.0.0.1:1234` };
      await sleep(80);
      yield { kind: "muted", text: "" };
      yield { kind: "muted", text: window.COPY.ERRORS.REFUSED_LMSTUDIO_HEAD };
      yield { kind: "muted", text: "" };
      yield { kind: "muted", text: "Make sure:" };
      yield { kind: "muted", text: "   1. LM Studio is open" };
      yield { kind: "muted", text: "   2. A model is loaded in the chat panel" };
      yield { kind: "muted", text: "   3. The \"Local Server\" tab is started (default port 1234)" };
      return { ok: false };
    }
    if (forceFail === "no-model") {
      yield { kind: "info", text: "▸ GET /v1/models — 200 OK (0 models loaded)" };
      await sleep(80);
      yield { kind: "error", text: `✕ ${window.COPY.ERRORS.NO_MODEL}` };
      yield { kind: "muted", text: "" };
      yield { kind: "muted", text: "Open LM Studio's chat tab, load a model from the My Models" };
      yield { kind: "muted", text: "panel, then return here and Test connection again." };
      return { ok: false };
    }
    if (forceFail === "auth") {
      yield { kind: "info", text: "▸ POST /v1/chat/completions" };
      await sleep(80);
      yield { kind: "error", text: "✕ Authentication failed (HTTP 401). Check the API key, then Test connection again." };
      return { ok: false };
    }
    if (forceFail === "404") {
      yield { kind: "error", text: `✕ Model "${model || "?"}" not found at this endpoint. Try blank for auto-detect, or pick from the model list.` };
      return { ok: false };
    }

    // Success path — verbatim per SPEC test-log
    yield { kind: "info", text: "▸ GET /v1/models — 200 OK (1 model: qwen2.5-7b-instruct)" };
    await sleep(100);
    yield { kind: "info", text: "▸ POST /v1/chat/completions" };
    yield { kind: "muted", text: "    prompt=\"hi\"  max_tokens=1" };
    await sleep(100);
    yield { kind: "info", text: "▸ Streaming response ..." };
    await sleep(100);
    yield { kind: "ok", text: "✓ Received 1 token in 423 ms" };
    await sleep(40);
    yield { kind: "muted", text: "" };
    yield { kind: "ok-bold", text: window.COPY.LLM_SETUP.SUCCESS_FINAL };
    return { ok: true, model: model || "qwen2.5-7b-instruct" };
  }

  // ---------------- mockStatus (observable) ----------------
  // status.values: 'green' | 'amber' | 'red'
  const statusListeners = new Set();
  const statusState = {
    llm: "amber", vts: "amber", sidecar: "green",
    llmDetail: "qwen2.5-7b · LM Studio · last reply 423ms",
    vtsDetail: "awaiting connection",
    sidecarDetail: "ws://127.0.0.1:53811/ws",
  };
  function emitStatus() { for (const l of statusListeners) l({ ...statusState }); }
  const mockStatus = {
    get() { return { ...statusState }; },
    subscribe(fn) { statusListeners.add(fn); fn({ ...statusState }); return () => statusListeners.delete(fn); },
    set(patch) { Object.assign(statusState, patch); emitStatus(); },
    cycle(which) {
      const order = ["green", "amber", "red"];
      const cur = statusState[which];
      const next = order[(order.indexOf(cur) + 1) % order.length];
      statusState[which] = next;
      // Update detail strings to feel alive
      if (which === "llm") {
        statusState.llmDetail = next === "green"
          ? "qwen2.5-7b · LM Studio · last reply 423ms"
          : next === "amber" ? "reconnecting…" : "connection refused at 127.0.0.1:1234";
      }
      if (which === "vts") {
        statusState.vtsDetail = next === "green" ? "teto · 60 Hz" : next === "amber" ? "awaiting plugin authorization" : "disconnected";
      }
      if (which === "sidecar") {
        statusState.sidecarDetail = next === "green" ? "ws://127.0.0.1:53811/ws" : next === "amber" ? "restarting…" : "crashed";
      }
      emitStatus();
    },
  };

  // worst-of-three resolver
  function worstOf(s) {
    if (s.llm === "red" || s.vts === "red" || s.sidecar === "red") return "red";
    if (s.llm === "amber" || s.vts === "amber" || s.sidecar === "amber") return "amber";
    return "green";
  }

  // ---------------- mockSidecarLogs ----------------
  // Returns a function to start emitting; takes a callback for each line.
  const SAMPLE_LOGS = [
    "[READY] sidecar ws://127.0.0.1:53811/ws",
    "[VTS] connected; rig=teto; injecting @60Hz",
    "[INTENT] expression=\"joy\" weight=1.0 → fade 300ms",
    "[TTS] sentence 2/3 synth 312ms",
    "[LLM] stream chunk: \"Curiosity sparkles in her eyes...\"",
    "[VTS] HotkeyTriggerRequest hk=test_prop",
    "[INTENT] gaze x=0.12 y=-0.04 → smooth 120ms",
    "[SIDECAR] heartbeat ok (parent pid alive)",
  ];
  function startSidecarLogs(onLine) {
    let i = 0;
    let running = true;
    const initialLines = [SAMPLE_LOGS[0], SAMPLE_LOGS[1], SAMPLE_LOGS[2]];
    initialLines.forEach((l, idx) => setTimeout(() => running && onLine(l), 50 + idx * 60));
    function tick() {
      if (!running) return;
      const line = SAMPLE_LOGS[i % SAMPLE_LOGS.length];
      i = (i + 1) % SAMPLE_LOGS.length;
      onLine(line);
      setTimeout(tick, 2000 + Math.random() * 3000);
    }
    setTimeout(tick, 2200);
    return () => { running = false; };
  }

  // ---------------- Banners / toasts (developer-panel triggers) ----------------
  const bannerListeners = new Set();
  const banners = {
    llm: false, vts: false, vtsAuth: false, sidecarRepeat: false, tts: false,
  };
  const toastListeners = new Set();

  const mockBanners = {
    subscribe(fn) { bannerListeners.add(fn); fn({ ...banners }); return () => bannerListeners.delete(fn); },
    set(patch) { Object.assign(banners, patch); for (const l of bannerListeners) l({ ...banners }); },
  };
  const mockToasts = {
    subscribe(fn) { toastListeners.add(fn); return () => toastListeners.delete(fn); },
    push(arg, ms = 3000) {
      // Accept either push("text") or push({id, text})
      const id = (arg && typeof arg === "object" && arg.id) || Math.random().toString(36).slice(2);
      const text = typeof arg === "string" ? arg : arg.text;
      for (const l of toastListeners) l({ kind: "add", id, text });
      setTimeout(() => { for (const l of toastListeners) l({ kind: "remove", id }); }, ms);
      return id;
    },
    remove(id) {
      for (const l of toastListeners) l({ kind: "remove", id });
    },
  };

  // ---------------- Scripted echo conversation injector ----------------
  const SCRIPTED_CONVO = [
    { role: "user", text: "hello" },
    { role: "assistant", text: "echo: hello" },
    { role: "user", text: "how does this prototype work?" },
    { role: "assistant", text: "echo: how does this prototype work?" },
    { role: "user", text: "thanks Teto" },
  ];

  // ---------------- Placeholder thread list (dev-panel toggle) ----------------
  const PLACEHOLDER_THREADS = {
    Today: [{ title: "Cat story" }, { title: "How to build a website" }],
    Yesterday: [{ title: "Genshin daily routine" }, { title: "Recipe brainstorm" }],
    Earlier: [{ title: "Onboarding" }, { title: "Naming a goldfish" }, { title: "First chat" }],
  };

  window.MOCK = {
    mockSafeStorage,
    mockEcho,
    mockTestConnection,
    mockStatus,
    worstOf,
    startSidecarLogs,
    mockBanners,
    mockToasts,
    SCRIPTED_CONVO,
    PLACEHOLDER_THREADS,
  };
})();
