export default function MasterLoading() {
  // SAShell já envolve o conteúdo em <main className="sa-page"> (padding).
  // Aqui usamos um fragmento para não duplicar o padding.
  return (
    <>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="sk sk-h1" style={{ width: 200 }} />
          <div className="sk sk-text" style={{ width: 300 }} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div className="sk sk-btn" style={{ width: 120 }} />
          <div className="sk sk-btn" style={{ width: 140 }} />
        </div>
      </div>

      {/* KPI grid */}
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="sk sk-card" style={{ height: 100 }} />
        ))}
      </div>

      {/* Painéis */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 18 }}>
        <div className="sk sk-card" style={{ height: 400 }} />
        <div className="sk sk-card" style={{ height: 400 }} />
      </div>
    </>
  );
}
