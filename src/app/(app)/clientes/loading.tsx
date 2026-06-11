export default function ClientesLoading() {
  return (
    <div className="page">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div className="sk sk-h1" style={{ width: 120 }} />
        <div className="sk sk-btn" style={{ width: 140 }} />
      </div>

      {/* Stats strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="sk sk-card" style={{ height: 72 }} />
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <div className="sk sk-btn" style={{ flex: 1 }} />
        <div className="sk sk-btn" style={{ width: 100 }} />
        <div className="sk sk-btn" style={{ width: 120 }} />
      </div>

      {/* Tabela */}
      <div className="sk sk-card" style={{ overflow: "hidden" }}>
        <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)" }}>
          <div className="sk sk-text" style={{ width: "100%", height: 36 }} />
        </div>
        {[...Array(8)].map((_, i) => (
          <div key={i} style={{ padding: "14px 18px", display: "flex", gap: 16, alignItems: "center", borderBottom: "1px solid var(--border)" }}>
            <div className="sk sk-avatar" style={{ width: 36, height: 36, flexShrink: 0 }} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <div className="sk sk-text sk-w-1/3" />
              <div className="sk sk-text sk-w-1/4" style={{ height: 11 }} />
            </div>
            <div className="sk sk-text" style={{ width: 100 }} />
            <div className="sk sk-text" style={{ width: 80 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
