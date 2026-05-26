"use client";

import { Fragment } from "react";

const STATS: { num: string; lines: string[]; amber?: boolean }[] = [
  { num: "86%", lines: ["dos agendamentos", "vêm pelo bot"] },
  { num: "−40%", lines: ["menos no-show", "com lembrete automático"], amber: true },
  { num: "5min", lines: ["pra configurar", "e sair do papel"] }
];

/** Faixa de números de impacto (fundo dark + blobs via ::before/::after). */
export function StatsBand() {
  return (
    <section className="lp-statsband">
      <div className="lp-container">
        <div className="lp-statsband__grid">
          {STATS.map((s) => (
            <div className="lp-stat-big lp-reveal" key={s.num}>
              <div className={`lp-stat-big__num ${s.amber ? "lp-stat-big__num--amber" : ""}`}>{s.num}</div>
              <div className="lp-stat-big__label">
                {s.lines.map((line, i) => (
                  <Fragment key={line}>
                    {i > 0 && <br />}
                    {line}
                  </Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
