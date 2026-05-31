"use client";

import { Clock, Loader2, Play, RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { apiFetch } from "@/lib/client-api";

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

type JobsResponse = {
  jobs: Job[];
  now: string;
};

type RunResult = {
  job: string;
  durationMs: number;
  result: { sent?: number; failed?: number; skipped?: number };
};

function formatRelative(value: string | null) {
  if (!value) return "nunca";
  const diff = Date.now() - new Date(value).getTime();
  if (diff < 0) {
    const absDiff = -diff;
    const minutes = Math.floor(absDiff / 60000);
    if (minutes < 60) return `em ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    return `em ${hours}h`;
  }
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes} min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export default function MasterFilasPage() {
  const [data, setData] = useState<JobsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [lastResult, setLastResult] = useState<Record<string, RunResult>>({});

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await apiFetch<JobsResponse>("/api/master/jobs");
      setData(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runJob(jobKey: string) {
    setError("");
    setRunning((prev) => ({ ...prev, [jobKey]: true }));
    try {
      const res = await apiFetch<RunResult>("/api/master/jobs/run", {
        method: "POST",
        body: JSON.stringify({ job: jobKey })
      });
      setLastResult((prev) => ({ ...prev, [jobKey]: res }));
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning((prev) => {
        const next = { ...prev };
        delete next[jobKey];
        return next;
      });
    }
  }

  return (
    <>
      <PageHeader
        title="Filas & jobs"
        subtitle="Workers e jobs agendados do node-cron"
        actions={
          <button type="button" className="btn btn-ghost" onClick={() => load()} disabled={loading}>
            <RefreshCcw size={15} /> Atualizar
          </button>
        }
      />

      {error && <div className="error-box">{error}</div>}

      <section className="panel">
        <div className="panel__head">
          <div>
            <div className="panel__title">Jobs registrados</div>
            <div className="panel__sub">{data?.jobs.length ?? 0} jobs no scheduler</div>
          </div>
        </div>
        <div className="panel__body panel__body--flush">
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
              <div className="loading-spinner" />
            </div>
          ) : !data || data.jobs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">
                <Clock size={24} />
              </div>
              <h3>Nenhum job registrado</h3>
              <p>O scheduler interno (node-cron) não tem jobs ativos no momento.</p>
            </div>
          ) : (
            <div className="table-wrap" style={{ borderRadius: 0, border: 0, boxShadow: "none" }}>
              <table>
                <thead>
                  <tr>
                    <th>Job</th>
                    <th>Schedule</th>
                    <th className="col-hide-mobile">Última execução</th>
                    <th className="col-hide-mobile">Próxima</th>
                    <th className="col-hide-mobile">Saídas 24h</th>
                    <th style={{ width: 160, textAlign: "right" }}>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {data.jobs.map((job) => {
                    const isRunning = !!running[job.key];
                    const result = lastResult[job.key];
                    return (
                      <tr key={job.key}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{job.label}</div>
                          <div style={{ fontSize: 12, color: "var(--muted)" }}>{job.description}</div>
                          {result && (
                            <div style={{ fontSize: 11, color: "var(--success)", marginTop: 4 }}>
                              Última execução manual: enviados={result.result.sent ?? 0}, falhas={result.result.failed ?? 0}, pulados={result.result.skipped ?? 0} ({result.durationMs}ms)
                            </div>
                          )}
                        </td>
                        <td>
                          <code
                            style={{
                              fontFamily: "var(--mono)",
                              fontSize: 12,
                              background: "var(--surface-muted)",
                              border: "1px solid var(--border)",
                              borderRadius: 6,
                              padding: "2px 6px"
                            }}
                          >
                            {job.schedule}
                          </code>
                          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{job.scheduleLabel}</div>
                        </td>
                        <td className="col-hide-mobile">
                          <div style={{ fontSize: 13 }}>{formatDate(job.lastRunAt)}</div>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>{formatRelative(job.lastRunAt)}</div>
                        </td>
                        <td className="col-hide-mobile">
                          <div style={{ fontSize: 13 }}>{formatDate(job.nextRunAt)}</div>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>{formatRelative(job.nextRunAt)}</div>
                        </td>
                        <td className="col-hide-mobile" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {job.last24h.sent}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => runJob(job.key)}
                            disabled={isRunning}
                          >
                            {isRunning ? <Loader2 size={13} className="spin" /> : <Play size={13} />}
                            {isRunning ? "Executando..." : "Forçar execução"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
