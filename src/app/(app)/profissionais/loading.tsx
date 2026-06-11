export default function ProfissionaisLoading() {
  return (
    <div className="page">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div className="sk sk-h1" style={{ width: 160 }} />
        <div className="sk sk-btn" style={{ width: 160 }} />
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="sk sk-card" style={{ height: 80 }} />
        ))}
      </div>

      {/* Grid de cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="sk sk-card" style={{ height: 200 }} />
        ))}
      </div>
    </div>
  );
}
