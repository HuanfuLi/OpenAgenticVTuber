// Phase 1 plan 01-01 Task 1 root component — minimal placeholder so the
// scaffold is verifiable. Task 3 of this plan replaces this with the full
// ThemeProvider + AppStoreProvider + AppShell composition.

export default function App() {
  return (
    <div className="app-window">
      <div
        style={{
          padding: 24,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8
        }}
      >
        <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>AgenticLLMVTuber</h1>
        <p className="muted" style={{ margin: 0 }}>
          Skeleton scaffold — chrome shell lands in Task 3.
        </p>
      </div>
    </div>
  )
}
