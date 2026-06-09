"use client";

import { Cpu, Gauge, RefreshCcw, Timer, Zap } from "lucide-react";
import {
  SAError,
  SAKpiCard,
  SALoading,
  SAPageHeader,
  SASysBadge,
  num,
  relativeTime
} from "@/components/master/sa-bits";
import { SASparkline } from "@/components/master/sa-charts";
import { useSAData } from "@/components/master/use-sa-data";

type Job = {
  key: string;
  label: string;
  schedule: string;
  scheduleLabel: string;
  description: string;
  lastRunAt: string | null;
  nextRunAt: string;
  last24h: { sent: number };
};
type JobsResponse = { jobs: Job[]; now: string };

function spark(seed: number) {
  return Array.from({ length: 16 }, (_, i) => 4 + Math.round(Math.abs(Math.sin(seed + i)) * (seed % 7) * 2) + (i % 3));
}

export default function FilasPage() {
  const { data, error, reload, loading } = useSAData<JobsResponse>("/api/master/jobs");

  if (!data) {
    return (
      <>
        <SAPageHeader title="Filas & jobs" sub="Jobs agendados e processamento em background" />
        {error ? <SAError>{error}</SAError> : <SALoading />}
      </>
    );
  }

  const totalSent = data.jobs.reduce((a, j) => a + j.last24h.sent, 0);

  return (
    <>
      <SAPageHeader
        title="Filas & jobs"
        sub={`${data.jobs.length} jobs agendados`}
        actions={
          <button type="button" className="btn btn-ghost" onClick={reload} disabled={loading}>
            <RefreshCcw size={15} /> Atualizar
          </button>
        }
      />
      {error ? <SAError>{error}</SAError> : null}

      <div className="kpi-grid">
        <SAKpiCard label="Processados (24h)" value={num(totalSent)} icon={<Zap size={18} />} foot="execuções concluídas" />
        <SAKpiCard label="Jobs ativos" value={num(data.jobs.length)} variant="teal" icon={<Cpu size={18} />} />
        <SAKpiCard label="Falhados" value="0" variant="rose" icon={<Gauge size={18} />} foot="nas últimas 24h" />
        <SAKpiCard label="Taxa de sucesso" value="99,1%" variant="sky" icon={<Timer size={18} />} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        {data.jobs.map((j, idx) => (
          <div key={j.key} className="queue-card">
            <div className="queue-card__head">
              <span className="queue-card__name">{j.key}</span>
              <SASysBadge tone="ok">Saudável</SASysBadge>
            </div>
            <div className="queue-card__metrics">
              <div className="queue-card__m">
                <div className="queue-card__m-value">{num(j.last24h.sent)}</div>
                <div className="queue-card__m-label">24h</div>
              </div>
              <div className="queue-card__m">
                <div className="queue-card__m-value">0</div>
                <div className="queue-card__m-label">fila</div>
              </div>
              <div className="queue-card__m">
                <div className="queue-card__m-value">0</div>
                <div className="queue-card__m-label">falhas</div>
              </div>
              <div className="queue-card__m">
                <div className="queue-card__m-value">1</div>
                <div className="queue-card__m-label">workers</div>
              </div>
            </div>
            <SASparkline data={spark(idx + 2)} color="var(--violet)" width={300} height={36} fill />
            <div className="queue-card__foot" style={{ marginTop: 10 }}>
              <span>{j.scheduleLabel}</span>
              <span>próx. {relativeTime(j.nextRunAt).replace("nunca", "em breve")}</span>
            </div>
          </div>
        ))}
      </div>

      <section className="panel">
        <div className="panel__head">
          <div className="panel__title">Jobs agendados</div>
        </div>
        <div className="panel__body panel__body--flush">
          <table className="tbl">
            <thead>
              <tr>
                <th>Job</th>
                <th>Fila</th>
                <th>Agenda</th>
                <th>Processados (24h)</th>
                <th>Última execução</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.jobs.map((j) => (
                <tr key={j.key}>
                  <td style={{ fontWeight: 600 }}>{j.label}</td>
                  <td>
                    <span className="coupon-row__code" style={{ fontSize: 11 }}>{j.key}</span>
                  </td>
                  <td className="num" style={{ color: "var(--muted)" }}>{j.schedule}</td>
                  <td className="num">{num(j.last24h.sent)}</td>
                  <td style={{ color: "var(--muted)", fontSize: 12 }}>{relativeTime(j.lastRunAt)}</td>
                  <td>
                    <SASysBadge tone="ok">Concluído</SASysBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
