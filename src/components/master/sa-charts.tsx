"use client";

/* ---------- Sparkline ---------- */

export function SASparkline({
  data,
  color = "var(--violet)",
  width = 120,
  height = 32,
  fill = false
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  fill?: boolean;
}) {
  if (data.length === 0) return <svg width={width} height={height} />;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const step = data.length > 1 ? width / (data.length - 1) : width;
  const points = data.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return [x, y] as const;
  });
  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {fill ? <path d={area} fill={color} opacity={0.14} /> : null}
      <path d={line} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------- Uptime Bars (90 days) ---------- */

export function SAUptimeBars({ data }: { data: ("good" | "mid" | "down")[] }) {
  return (
    <div className="uptime-bars">
      {data.map((tone, i) => (
        <span
          key={i}
          className={`uptime-bars__bar uptime-bars__bar--${tone}`}
          style={{ height: tone === "down" ? 8 : tone === "mid" ? 13 : 20 }}
        />
      ))}
    </div>
  );
}

/* ---------- Gauge Ring ---------- */

export function SAGaugeRing({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const tone = pct >= 80 ? "high" : pct >= 60 ? "mid" : "good";
  const color = tone === "high" ? "var(--rose)" : tone === "mid" ? "var(--amber)" : "var(--success)";
  return (
    <div className={`gauge gauge--${tone}`}>
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: "50%",
          background: `conic-gradient(${color} ${pct * 3.6}deg, var(--surface-2) ${pct * 3.6}deg)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: "50%",
            background: "var(--surface)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <span className="gauge__value">{Math.round(pct)}%</span>
        </div>
      </div>
      <span className="gauge__label">{label}</span>
    </div>
  );
}

/* ---------- Donut ---------- */

export type DonutSlice = { label: string; value: number; color: string };

export function SADonut({ slices, size = 160 }: { slices: DonutSlice[]; size?: number }) {
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  const r = size / 2 - 14;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {slices.map((s, i) => {
            const frac = s.value / total;
            const dash = frac * c;
            const el = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={20}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return el;
          })}
        </g>
      </svg>
      <div className="donut-legend">
        {slices.map((s, i) => (
          <div className="donut-legend__item" key={i}>
            <span className="donut-legend__dot" style={{ background: s.color }} />
            <span>{s.label}</span>
            <span className="donut-legend__pct">{Math.round((s.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Line Chart (multi-series) ---------- */

export type LineSeries = { color: string; data: number[]; fill?: boolean };

export function SALineChart({
  series,
  labels,
  height = 220
}: {
  series: LineSeries[];
  labels?: string[];
  height?: number;
}) {
  const width = 640;
  const padX = 8;
  const padY = 14;
  const all = series.flatMap((s) => s.data);
  const max = Math.max(...all, 1);
  const min = Math.min(...all, 0);
  const range = max - min || 1;
  const count = Math.max(...series.map((s) => s.data.length), 1);
  const step = count > 1 ? (width - padX * 2) / (count - 1) : width;

  const toPath = (data: number[]) =>
    data
      .map((v, i) => {
        const x = padX + i * step;
        const y = height - padY - ((v - min) / range) * (height - padY * 2);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: "block" }}>
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1={0} x2={width} y1={height * g} y2={height * g} stroke="var(--border)" strokeWidth={1} />
      ))}
      {series.map((s, i) => (
        <g key={i}>
          {s.fill ? (
            <path
              d={`${toPath(s.data)} L${padX + (s.data.length - 1) * step},${height - padY} L${padX},${height - padY} Z`}
              fill={s.color}
              opacity={0.13}
            />
          ) : null}
          <path d={toPath(s.data)} fill="none" stroke={s.color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
        </g>
      ))}
      {labels
        ? labels.map((l, i) => (
            <text
              key={i}
              x={padX + i * step}
              y={height - 2}
              fontSize={9}
              fill="var(--muted)"
              textAnchor="middle"
              fontFamily="var(--mono)"
            >
              {l}
            </text>
          ))
        : null}
    </svg>
  );
}

/* ---------- Bar Chart ---------- */

export function SABarChart({
  data,
  height = 160
}: {
  data: { label?: string; segments: { value: number; color: string }[] }[];
  height?: number;
}) {
  const max = Math.max(...data.map((d) => d.segments.reduce((a, s) => a + s.value, 0)), 1);
  return (
    <div className="bar-chart" style={{ height }}>
      {data.map((d, i) => (
        <div className="bar-chart__col" key={i}>
          <div style={{ width: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", flex: 1 }}>
            {d.segments.map((s, j) => (
              <div
                key={j}
                className="bar-chart__bar"
                style={{
                  height: `${(s.value / max) * (height - 18)}px`,
                  background: s.color,
                  borderRadius: j === 0 ? "3px 3px 0 0" : 0
                }}
              />
            ))}
          </div>
          {d.label ? <span className="bar-chart__label">{d.label}</span> : null}
        </div>
      ))}
    </div>
  );
}

/* ---------- Signal Bars ---------- */

export function SASignal({ level }: { level: number }) {
  const tone = level >= 3 ? "var(--success)" : level >= 2 ? "var(--amber)" : "var(--rose)";
  return (
    <span className="signal">
      {[1, 2, 3, 4].map((b) => (
        <span
          key={b}
          className="signal__bar"
          style={{ height: 4 + b * 3, background: b <= level ? tone : "var(--surface-3)" }}
        />
      ))}
    </span>
  );
}

/* ---------- Waterfall ---------- */

export type WaterfallRow = { label: string; value: number; kind: "pos" | "neg" | "total" | "base" };

export function SAWaterfall({ rows }: { rows: WaterfallRow[] }) {
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  return (
    <div className="waterfall">
      {rows.map((r, i) => {
        const valCls = r.kind === "pos" ? "waterfall__val--pos" : r.kind === "neg" ? "waterfall__val--neg" : "waterfall__val--total";
        const barColor = r.kind === "pos" ? "var(--success)" : r.kind === "neg" ? "var(--rose)" : "var(--violet)";
        const sign = r.kind === "pos" ? "+" : r.kind === "neg" ? "−" : "";
        return (
          <div className="waterfall__row" key={i}>
            <span className="waterfall__label">{r.label}</span>
            <div className="waterfall__bar">
              <div style={{ width: `${(Math.abs(r.value) / max) * 100}%`, background: barColor }} />
            </div>
            <span className={`waterfall__val ${valCls}`}>
              {sign}
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(
                Math.abs(r.value)
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
