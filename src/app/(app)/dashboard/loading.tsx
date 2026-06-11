export default function DashboardLoading() {
  return (
    <div className="page">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="sk sk-h1" style={{ width: 200 }} />
          <div className="sk sk-text" style={{ width: 280 }} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div className="sk sk-btn" style={{ width: 120 }} />
          <div className="sk sk-btn" style={{ width: 160 }} />
        </div>
      </div>

      {/* KPI cards */}
      <div className="dash-kpis" style={{ marginBottom: 24 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="sk sk-card" style={{ height: 110 }} />
        ))}
      </div>

      {/* Grid 2 colunas */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 20, marginBottom: 20 }}>
        <div className="sk sk-card" style={{ height: 360 }} />
        <div className="sk sk-card" style={{ height: 360 }} />
      </div>

      {/* Grid 3 colunas */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 20 }}>
        <div className="sk sk-card" style={{ height: 280 }} />
        <div className="sk sk-card" style={{ height: 280 }} />
        <div className="sk sk-card" style={{ height: 280 }} />
      </div>
    </div>
  );
}
