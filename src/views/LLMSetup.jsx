/* SPEC LLM Setup screen + USERFLOW B (cold launch). */
const { mockTestConnection } = window.MOCK;

function LLMSetup() {
  const COPY = window.COPY.SETUP;
  const { completeSetup } = useStore();

  const [provider, setProvider] = useState("lmstudio");
  const [endpoint, setEndpoint] = useState("http://localhost:1234/v1");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [logLines, setLogLines] = useState([]);
  const [phase, setPhase] = useState("idle"); // idle | testing | success | error
  const [errorKind, setErrorKind] = useState(null);

  const onTest = async () => {
    setPhase("testing");
    setLogLines([]);
    setErrorKind(null);

    // Decide outcome from a hint in the endpoint string for prototype testing
    const willFail = /:9999|fail|wrong|broken/i.test(endpoint);
    const result = mockTestConnection(provider, endpoint, apiKey, model, { fail: willFail });
    for await (const line of result) {
      setLogLines((cur) => [...cur, line]);
    }
    if (willFail) {
      setPhase("error");
      setErrorKind("unreachable");
    } else {
      setPhase("success");
    }
  };

  const canContinue = phase === "success";

  return (
    <div className="view" style={{ background: "var(--background)" }} data-theme-surface>
      <div className="setup">
        <h1>{COPY.HEADER}</h1>
        <p className="sub">{COPY.SUB}</p>

        <div className="field">
          <label className="label" htmlFor="provider">{COPY.PROVIDER_LABEL}</label>
          <select id="provider" className="select" value={provider} onChange={(e) => setProvider(e.target.value)}>
            <option value="lmstudio">LM Studio</option>
            <option value="ollama" disabled>Ollama (coming in milestone-2)</option>
            <option value="openai" disabled>OpenAI-compatible (coming in milestone-2)</option>
          </select>
          <div className="provider-list">
            <div className="row"><span className="name">· LM Studio</span><span>(default)</span></div>
            <div className="row disabled"><span className="name">· Ollama</span><span>(coming in milestone-2)</span></div>
            <div className="row disabled"><span className="name">· OpenAI-compatible</span><span>(coming in milestone-2)</span></div>
          </div>
        </div>

        <div className="field">
          <div className="field-row">
            <label className="label" htmlFor="endpoint">{COPY.ENDPOINT_LABEL}</label>
            <span className="helper">{COPY.ENDPOINT_HELP}</span>
          </div>
          <input id="endpoint" className="input" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="http://localhost:1234/v1" />
        </div>

        <div className="field">
          <div className="field-row">
            <label className="label" htmlFor="model">{COPY.MODEL_LABEL}</label>
            <span className="helper">{COPY.MODEL_HELP}</span>
          </div>
          <input id="model" className="input" value={model} onChange={(e) => setModel(e.target.value)} placeholder="auto-detect" />
        </div>

        <div className="field">
          <label className="label" htmlFor="apikey">{COPY.APIKEY_LABEL}</label>
          <input id="apikey" type="password" className="input" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={COPY.APIKEY_PLACEHOLDER} />
        </div>

        <button className="btn btn-secondary" onClick={onTest} disabled={phase === "testing"} style={{ alignSelf: "flex-start" }}>
          {phase === "testing" ? COPY.TEST_BTN_RUNNING : COPY.TEST_BTN}
        </button>

        {logLines.length > 0 && (
          <div className="test-log">
            <div className="title">{COPY.LOG_TITLE}</div>
            {logLines.map((l, i) => (
              <div key={i} className={`line ${l.kind || ""}`}>{l.text}</div>
            ))}
          </div>
        )}

        {phase === "error" && errorKind === "unreachable" && (
          <div className="card mt-2" style={{ borderColor: "color-mix(in oklab, var(--destructive), transparent 50%)" }}>
            <div className="semibold" style={{ color: "var(--destructive)" }}>⚠ {COPY.ERROR_UNREACHABLE_TITLE}</div>
            <ol style={{ margin: "8px 0 0 18px", padding: 0, color: "var(--muted-foreground)", fontSize: 14 }}>
              {COPY.ERROR_UNREACHABLE_STEPS.map((s, i) => <li key={i} style={{ marginBottom: 4 }}>{s}</li>)}
            </ol>
          </div>
        )}

        <div className="setup-actions">
          <button className="btn btn-link" onClick={() => alert("(mock) Would open: setup help docs")}>{COPY.HELP_LINK}</button>
          <button
            className="btn btn-primary"
            disabled={!canContinue}
            onClick={() => completeSetup({ provider, endpoint, model, apiKey })}
          >
            {COPY.CONTINUE}
          </button>
        </div>
      </div>
    </div>
  );
}
window.LLMSetup = LLMSetup;
