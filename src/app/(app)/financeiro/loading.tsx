export default function FinanceiroLoading() {
  return (
    <div className="page">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div className="sk sk-h1" style={{ width: 140 }} />
        <div style={{ display: "flex", gap: 8 }}>
          <div className="sk sk-btn" style={{ width: 120 }} />
          <div className="sk sk-btn" style={{ width: 140 }} />
        </div>
      </div>

      {/* KPI cards */}
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="sk sk-card" style={{ height: 100 }} />
        ))}
      </div>

      {/* DRE + gráfico */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 20, marginBottom: 20 }}>
        <div className="sk sk-card" style={{ height: 300 }} />
        <div className="sk sk-card" style={{ height: 300 }} />
      </div>

      {/* Tabela de lançamentos */}
      <div className="sk sk-card" style={{ overflow: "hidden" }}>
        {[...Array(7)].map((_, i) => (
          <div key={i} style={{ padding: "14px 18px", display: "flex", gap: 14, alignItems: "center", borderBottom: "1px solid var(--border)" }}>
            <div className="sk" style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0 }} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <div className="sk sk-text sk-w-2/3" />
              <div className="sk sk-text sk-w-1/3" style={{ height: 11 }} />
            </div>
            <div className="sk sk-text" style={{ width: 80 }} />
            <div className="sk" style={{ width: 70, height: 24, borderRadius: 999 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
