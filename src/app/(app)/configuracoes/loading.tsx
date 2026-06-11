export default function ConfiguracoesLoading() {
  return (
    <div className="page">
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="sk sk-h1" style={{ width: 180 }} />
          <div className="sk sk-text" style={{ width: 300 }} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div className="sk sk-btn" style={{ width: 100 }} />
          <div className="sk sk-btn" style={{ width: 140 }} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 22 }}>
        {/* Sidebar */}
        <div className="sk sk-card" style={{ height: 480 }} />
        {/* Conteúdo */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="sk sk-card" style={{ height: 200 }} />
          <div className="sk sk-card" style={{ height: 280 }} />
          <div className="sk sk-card" style={{ height: 180 }} />
        </div>
      </div>
    </div>
  );
}
