"use client";

import { AlertOctagon, Eye, RefreshCcw, Search, Shield, ShieldAlert, Activity } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { SAEmpty, SAError, SAKpiCard, SALoading, SAPageHeader, num } from "@/components/master/sa-bits";
import { useSAData } from "@/components/master/use-sa-data";

type Severity = "info" | "ok" | "warn" | "crit";
type Event = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  ipAddress: string | null;
  companyName: string | null;
  userName: string | null;
  userEmail: string | null;
  severity: Severity;
};
type AuditResponse = {
  metrics: { events30d: number; impersonations: number; securityEvents: number; criticalEvents: number };
  events: Event[];
};

type Filter = "all" | "auth" | "impersonation" | "billing" | "config" | "crit";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Tudo" },
  { key: "auth", label: "Autenticação" },
  { key: "impersonation", label: "Impersonation" },
  { key: "billing", label: "Cobrança" },
  { key: "config", label: "Configuração" },
  { key: "crit", label: "Críticos" }
];

const BADGE: Record<Severity, { cls: string; label: string }> = {
  info: { cls: "info", label: "INFO" },
  ok: { cls: "ok", label: "OK" },
  warn: { cls: "warn", label: "AVISO" },
  crit: { cls: "crit", label: "CRÍTICO" }
};

const ICON: Record<Severity, ReactNode> = {
  info: <Activity size={14} />,
  ok: <Shield size={14} />,
  warn: <ShieldAlert size={14} />,
  crit: <AlertOctagon size={14} />
};

function matchFilter(e: Event, f: Filter) {
  const a = e.action.toLowerCase();
  if (f === "all") return true;
  if (f === "crit") return e.severity === "crit";
  if (f === "auth") return ["login", "logout", "auth", "password"].some((k) => a.includes(k));
  if (f === "impersonation") return a.includes("impersonate");
  if (f === "billing") return ["payment", "invoice", "subscription", "plan", "charge"].some((k) => a.includes(k));
  if (f === "config") return ["flag", "config", "setting", "update", "create"].some((k) => a.includes(k));
  return true;
}

function timeLabel(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export default function LogsPage() {
  const { data, error, reload, loading } = useSAData<AuditResponse>("/api/master/audit");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const events = useMemo(() => {
    if (!data) return [];
    let rows = data.events.filter((e) => matchFilter(e, filter));
    const term = search.trim().toLowerCase();
    if (term) {
      rows = rows.filter(
        (e) =>
          e.action.toLowerCase().includes(term) ||
          (e.userName ?? "").toLowerCase().includes(term) ||
          (e.userEmail ?? "").toLowerCase().includes(term) ||
          (e.companyName ?? "").toLowerCase().includes(term)
      );
    }
    return rows;
  }, [data, search, filter]);

  if (!data) {
    return (
      <>
        <SAPageHeader title="Logs & auditoria" sub="Eventos da plataforma e trilha de auditoria" />
        {error ? <SAError>{error}</SAError> : <SALoading />}
      </>
    );
  }

  const m = data.metrics;

  return (
    <>
      <SAPageHeader
        title="Logs & auditoria"
        sub="Eventos da plataforma e trilha de auditoria"
        actions={
          <button type="button" className="btn btn-ghost" onClick={reload} disabled={loading}>
            <RefreshCcw size={15} /> Atualizar
          </button>
        }
      />
      {error ? <SAError>{error}</SAError> : null}

      <div className="kpi-grid">
        <SAKpiCard label="Eventos (30d)" value={num(m.events30d)} icon={<Activity size={18} />} />
        <SAKpiCard label="Impersonations" value={num(m.impersonations)} variant="teal" icon={<Eye size={18} />} />
        <SAKpiCard label="Alertas de segurança" value={num(m.securityEvents)} variant="amber" icon={<ShieldAlert size={18} />} />
        <SAKpiCard label="Eventos críticos" value={num(m.criticalEvents)} variant="rose" icon={<AlertOctagon size={18} />} />
      </div>

      <section className="panel">
        <div className="tbl-filter">
          <div className="grow">
            <Search size={15} />
            <input type="search" placeholder="Buscar ação, usuário ou empresa…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {FILTERS.map((f) => (
            <button key={f.key} type="button" className={`chip-tab ${filter === f.key ? "is-on" : ""}`} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>

        <div className="panel__body panel__body--flush">
          {events.length === 0 ? (
            <SAEmpty icon={<Shield size={24} />} title="Nenhum evento" message="Ajuste a busca ou o filtro." />
          ) : (
            events.map((e) => {
              const badge = BADGE[e.severity];
              return (
                <div className="log-item" key={e.id}>
                  <span className="log-item__time">{timeLabel(e.createdAt)}</span>
                  <span className={`log-item__icon log-item__icon--${badge.cls}`}>{ICON[e.severity]}</span>
                  <div className="log-item__body">
                    <div className="log-item__desc">
                      <code>{e.action}</code> em <code>{e.entityType}</code>
                      {e.userName ? <> por <strong>{e.userName}</strong></> : null}
                      {e.companyName ? <> · <code>{e.companyName}</code></> : null}
                      {e.ipAddress ? <span style={{ color: "var(--muted)" }}> · {e.ipAddress}</span> : null}
                    </div>
                  </div>
                  <span className={`log-item__badge log-item__badge--${badge.cls}`}>{badge.label}</span>
                </div>
              );
            })
          )}
        </div>
      </section>
    </>
  );
}
