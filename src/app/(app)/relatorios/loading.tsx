export default function RelatoriosLoading() {
  return (
    <div className="page">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div className="sk sk-h1" style={{ width: 140 }} />
        <div className="sk sk-btn" style={{ width: 120 }} />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, padding: 4, background: "var(--surface)", borderRadius: 10, marginBottom: 20 }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="sk" style={{ height: 36, flex: 1, borderRadius: 7 }} />
        ))}
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="sk sk-card" style={{ height: 90 }} />
        ))}
      </div>

      {/* Gráficos */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 18, marginBottom: 18 }}>
        <div className="sk sk-card" style={{ height: 280 }} />
        <div className="sk sk-card" style={{ height: 280 }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <div className="sk sk-card" style={{ height: 320 }} />
        <div className="sk sk-card" style={{ height: 320 }} />
      </div>
    </div>
  );
}
