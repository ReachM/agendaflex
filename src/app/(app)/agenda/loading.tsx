import { Fragment } from "react";

export default function AgendaLoading() {
  return (
    <div className="page">
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div className="sk sk-btn" style={{ width: 220 }} />
        <div className="sk sk-btn" style={{ width: 160 }} />
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <div className="sk sk-btn" style={{ width: 100 }} />
          <div className="sk sk-btn" style={{ width: 140 }} />
        </div>
      </div>

      {/* Chips de profissionais */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="sk" style={{ height: 32, width: 80 + i * 15, borderRadius: 999 }} />
        ))}
      </div>

      {/* Grade semanal */}
      <div style={{ display: "grid", gridTemplateColumns: "60px repeat(7, 1fr)", gap: 2 }}>
        {/* Header dos dias */}
        <div />
        {[...Array(7)].map((_, i) => (
          <div key={`d${i}`} className="sk" style={{ height: 48, borderRadius: 8 }} />
        ))}
        {/* Linhas de hora */}
        {[...Array(10)].map((_, row) => (
          <Fragment key={`row-${row}`}>
            <div className="sk sk-text" style={{ width: 40, alignSelf: "center" }} />
            {[...Array(7)].map((_, col) => (
              <div
                key={`c${row}-${col}`}
                className="sk"
                style={{
                  height: 60,
                  borderRadius: 6,
                  // padrão determinístico (evita mismatch de hidratação)
                  opacity: (row * 3 + col * 5) % 7 > 4 ? 1 : 0.3,
                }}
              />
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
