"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, MessageCircle, Power, RefreshCcw, Search, WifiOff, Zap } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { apiFetch } from "@/lib/client-api";

type Instance = {
  id: string;
  companyId: string;
  companyName: string;
  companySlug: string | null;
  companyPlan: string;
  companyStatus: string;
  botEnabled: boolean;
  whatsappInstance: string | null;
  allowBooking: boolean;
  updatedAt: string;
  createdAt: string;
  stats: { conversations24h: number; reminders24h: number; botAppointments7d: number };
  health: "good" | "mid" | "low";
  idleDays: number;
};

type Response = {
  metrics: {
    totalConfigured: number;
    activeBots: number;
    instancesWithKey: number;
    totalConversations24h: number;
    totalReminders24h: number;
    totalBotAppts7d: number;
  };
  instances: Instance[];
};

type StatusFilter = "all" | "ONLINE" | "OFFLINE" | "IDLE";

function planTagClass(slug: string): string {
  if (slug === "max") return "plan-tag--max";
  if (slug === "pro") return "plan-tag--pro";
  if (slug === "starter") return "plan-tag--starter";
  return "plan-tag--free";
}

export default function MasterInstanciasPage() {
  const [data, setData] = useState<Response | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiFetch<Response>("/api/master/instances");
      setData(result);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let rows = data.instances;
    if (statusFilter !== "all") {
      rows = rows.filter(i => {
        const connected = i.botEnabled && Boolean(i.whatsappInstance);
        if (statusFilter === "ONLINE") return connected && (i.stats.conversations24h > 0 || i.stats.reminders24h > 0);
        if (statusFilter === "IDLE") return connected && i.stats.conversations24h === 0 && i.stats.reminders24h === 0;
        if (statusFilter === "OFFLINE") return !connected;
        return true;
      });
    }
    const term = search.trim().toLowerCase();
    if (term) {
      rows = rows.filter(i =>
        i.companyName.toLowerCase().includes(term) ||
        (i.companySlug ?? "").toLowerCase().includes(term) ||
        (i.whatsappInstance ?? "").toLowerCase().includes(term)
      );
    }
    return rows;
  }, [data, search, statusFilter]);

  if (!data) {
    return (
      <>
        <PageHeader title="Instâncias WhatsApp" subtitle="Status global das integrações Evolution API" />
        {error ? <div className="error-box">{error}</div> : <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><div className="loading-spinner" /></div>}
      </>
    );
  }

  const m = data.metrics;

  return (
    <>
      <PageHeader
        title="Instâncias WhatsApp"
        subtitle={`${m.activeBots} bots ativos · ${m.totalConfigured} configurados`}
        actions={
          <>
            <span className="env-pill"><span className="dot" /> PRODUCTION</span>
            <button type="button" className="btn btn-ghost" onClick={load} disabled={loading}>
              <RefreshCcw size={15} /> Atualizar
            </button>
          </>
        }
      />

      {error ? <div className="error-box">{error}</div> : null}

      <div className="grid cols-4" style={{ marginBottom: 22 }}>
        <Kpi label="Bots ativos" value={m.activeBots} icon={<Power size={18} />} variant="emerald" hint={`${m.totalConfigured} configurados`} />
        <Kpi label="Conversas (24h)" value={m.totalConversations24h} icon={<MessageCircle size={18} />} variant="sky" />
        <Kpi label="Lembretes enviados (24h)" value={m.totalReminders24h} icon={<Zap size={18} />} variant="amber" />
        <Kpi label="Agendados pelo bot (7d)" value={m.totalBotAppts7d} icon={<Bot size={18} />} variant="default" />
      </div>

      <section className="panel">
        <div className="panel__head" style={{ flexDirection: "column", alignItems: "stretch", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div className="panel__title">Instâncias</div>
              <div className="panel__sub">{filtered.length} de {data.instances.length} exibidas</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className={`chip-tab ${statusFilter === "all" ? "is-on" : ""}`} onClick={() => setStatusFilter("all")}>Todas</button>
              <button type="button" className={`chip-tab ${statusFilter === "ONLINE" ? "is-on" : ""}`} onClick={() => setStatusFilter("ONLINE")}>Ativas (24h)</button>
              <button type="button" className={`chip-tab ${statusFilter === "IDLE" ? "is-on" : ""}`} onClick={() => setStatusFilter("IDLE")}>Ociosas</button>
              <button type="button" className={`chip-tab ${statusFilter === "OFFLINE" ? "is-on" : ""}`} onClick={() => setStatusFilter("OFFLINE")}>Desligadas</button>
            </div>
          </div>
          <div className="inline-search">
            <Search size={14} />
            <input type="search" placeholder="Buscar por empresa, slug ou nome da instância..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="panel__body panel__body--flush">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon"><Bot size={24} /></div>
              <h3>Nenhuma instância no filtro</h3>
              <p>Ajuste a busca ou troque o filtro de status.</p>
            </div>
          ) : (
            <div className="table-wrap" style={{ borderRadius: 0, border: 0, boxShadow: "none" }}>
              <table>
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>Plano</th>
                    <th>Instância</th>
                    <th className="col-hide-mobile">Conv. 24h</th>
                    <th className="col-hide-mobile">Lemb. 24h</th>
                    <th className="col-hide-mobile">Agend. 7d</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((i, idx) => {
                    const connected = i.botEnabled && Boolean(i.whatsappInstance);
                    const initials = i.companyName.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
                    return (
                      <tr key={i.id}>
                        <td>
                          <div className="biz">
                            <span className={`biz__avt av-${(idx % 8) + 1}`}>{initials}</span>
                            <div>
                              <div className="biz__nm">{i.companyName}</div>
                              <div className="biz__sub">{i.companySlug ?? `id: ${i.companyId.slice(0, 8)}`}</div>
                            </div>
                          </div>
                        </td>
                        <td><span className={`plan-tag ${planTagClass(i.companyPlan)}`}>{i.companyPlan.toUpperCase()}</span></td>
                        <td style={{ fontFamily: "monospace", fontSize: 12 }}>
                          {i.whatsappInstance ?? <span style={{ color: "var(--muted)" }}>—</span>}
                          {i.allowBooking ? <span className="pill pill--info" style={{ marginLeft: 6, fontSize: 9 }}>+ Agenda</span> : null}
                        </td>
                        <td className="col-hide-mobile" style={{ fontVariantNumeric: "tabular-nums" }}>{i.stats.conversations24h}</td>
                        <td className="col-hide-mobile" style={{ fontVariantNumeric: "tabular-nums" }}>{i.stats.reminders24h}</td>
                        <td className="col-hide-mobile" style={{ fontVariantNumeric: "tabular-nums" }}>{i.stats.botAppointments7d}</td>
                        <td>
                          {!connected ? (
                            <span className="status-dot status-dot--churned"><span className="d" /> <WifiOff size={11} style={{ marginRight: 4 }} /> Desligada</span>
                          ) : i.stats.conversations24h > 0 || i.stats.reminders24h > 0 ? (
                            <span className="status-dot status-dot--active"><span className="d" /> Online</span>
                          ) : i.idleDays < 7 ? (
                            <span className="status-dot status-dot--trial"><span className="d" /> Conectada</span>
                          ) : (
                            <span className="status-dot status-dot--overdue"><span className="d" /> Ociosa {i.idleDays}d</span>
                          )}
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

function Kpi({ label, value, icon, variant = "default", hint }: {
  label: string;
  value: number;
  icon: React.ReactNode;
  variant?: "default" | "emerald" | "sky" | "rose" | "amber";
  hint?: string;
}) {
  const cls = variant === "default" ? "" : `kpi--${variant}`;
  return (
    <div className={`kpi ${cls}`}>
      <div className="kpi__head">
        <span className="kpi__label">{label}</span>
        <span className="kpi__icon">{icon}</span>
      </div>
      <div className="kpi__value">{value}</div>
      {hint ? <div className="kpi__foot"><span>{hint}</span></div> : null}
    </div>
  );
}
