export default function ServicosLoading() {
  return (
    <div className="page">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div className="sk sk-h1" style={{ width: 120 }} />
        <div className="sk sk-btn" style={{ width: 140 }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 20 }}>
        {/* Sidebar categorias */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="sk" style={{ height: 40, borderRadius: 8 }} />
          ))}
        </div>

        {/* Cards de serviços */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
          {[...Array(8)].map((_, i) => (
            <div key={i} className="sk sk-card" style={{ height: 150 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
