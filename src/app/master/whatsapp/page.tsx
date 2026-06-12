"use client";

import { Clock, ExternalLink, MessageCircle, RefreshCcw, Search, Wifi } from "lucide-react";
import { useMemo, useState } from "react";
import {
  SABiz,
  SAEmpty,
  SAError,
  SALoading,
  SAMiniKpi,
  SAPageHeader,
  SAStatusDot,
  num,
  relativeTime
} from "@/components/master/sa-bits";
import { SASignal } from "@/components/master/sa-charts";
import { useSAData } from "@/components/master/use-sa-data";
import { apiFetch } from "@/lib/client-api";

type Instance = {
  id: string;
  companyId: string;
  companyName: string;
  companySlug: string | null;
  whatsappInstance: string | null;
  botEnabled: boolean;
  stats: { conversations24h: number; reminders24h: number; botAppointments7d: number };
  health: "good" | "mid" | "low";
  idleDays: number;
  updatedAt: string;
};
type InstancesResponse = {
  metrics: { totalConfigured: number; activeBots: number; instancesWithKey: number; totalConversations24h: number; totalReminders24h: number };
  instances: Instance[];
};

type BotRequest = {
  companyId: string;
  companyName: string;
  adminName: string;
  adminEmail: string;
  phone: string;
  notes: string | null;
  requestedAt: string;
  status: string;
};
type BotRequestsResponse = { requests: BotRequest[]; total: number };

type Filter = "all" | "connected" | "disconnected" | "noqr";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "connected", label: "Conectadas" },
  { key: "disconnected", label: "Desconectadas" },
  { key: "noqr", label: "Sem instância" }
];

function connState(i: Instance): { status: string; label: string; level: number } {
  const connected = i.botEnabled && Boolean(i.whatsappInstance);
  if (!connected && !i.whatsappInstance) return { status: "TRIALING", label: "Aguardando QR", level: 1 };
  if (!connected) return { status: "PAST_DUE", label: "Desconectada", level: 0 };
  if (i.health === "mid") return { status: "SUSPENDED", label: "Conectada · lenta", level: 2 };
  return { status: "ACTIVE", label: "Conectada", level: 4 };
}

export default function WhatsappPage() {
  const { data, error, reload, loading } = useSAData<InstancesResponse>("/api/master/instances");
  const { data: requestsData, reload: reloadRequests } = useSAData<BotRequestsResponse>("/api/master/bot-requests");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState(false);

  async function updateRequest(companyId: string, status: "in_progress" | "done") {
    setBusy(true);
    try {
      await apiFetch("/api/master/bot-requests", {
        method: "PATCH",
        body: JSON.stringify({ companyId, status })
      });
      await reloadRequests();
    } catch {
      // erro silencioso — a lista permanece como está
    } finally {
      setBusy(false);
    }
  }

  const filtered = useMemo(() => {
    if (!data) return [];
    let rows = data.instances;
    if (filter === "connected") rows = rows.filter((i) => i.botEnabled && Boolean(i.whatsappInstance));
    else if (filter === "disconnected") rows = rows.filter((i) => !(i.botEnabled && Boolean(i.whatsappInstance)) && Boolean(i.whatsappInstance));
    else if (filter === "noqr") rows = rows.filter((i) => !i.whatsappInstance);
    const term = search.trim().toLowerCase();
    if (term) {
      rows = rows.filter(
        (i) => i.companyName.toLowerCase().includes(term) || (i.whatsappInstance ?? "").toLowerCase().includes(term)
      );
    }
    return rows;
  }, [data, search, filter]);

  if (!data) {
    return (
      <>
        <SAPageHeader title="Instâncias WhatsApp" sub="Conexões Evolution API por empresa" />
        {error ? <SAError>{error}</SAError> : <SALoading />}
      </>
    );
  }

  const m = data.metrics;
  const connected = data.instances.filter((i) => i.botEnabled && Boolean(i.whatsappInstance)).length;
  const disconnected = data.instances.filter((i) => !(i.botEnabled && Boolean(i.whatsappInstance)) && Boolean(i.whatsappInstance)).length;
  const waiting = data.instances.filter((i) => !i.whatsappInstance).length;

  return (
    <>
      <SAPageHeader
        title="Instâncias WhatsApp"
        sub={`${num(m.totalConfigured)} instâncias configuradas`}
        actions={
          <>
            <a href="http://2.25.129.96:8080/manager/" target="_blank" rel="noreferrer" className="btn btn-ghost">
              <ExternalLink size={14} /> Evolution Manager
            </a>
            <button type="button" className="btn btn-ghost" onClick={reload} disabled={loading}>
              <RefreshCcw size={15} /> Atualizar
            </button>
          </>
        }
      />
      {error ? <SAError>{error}</SAError> : null}

      <div className="mini-kpis">
        <SAMiniKpi value={num(connected)} label="conectadas" icon={<Wifi size={18} />} variant="teal" />
        <SAMiniKpi value={num(waiting)} label="aguardando QR" icon={<MessageCircle size={18} />} variant="sky" />
        <SAMiniKpi value={num(disconnected)} label="desconectadas" icon={<MessageCircle size={18} />} variant="rose" />
        <SAMiniKpi value={num(m.totalReminders24h)} label="msgs / 24h" icon={<MessageCircle size={18} />} />
      </div>

      {requestsData && requestsData.requests.length > 0 ? (
        <section className="panel" style={{ marginBottom: 16, borderColor: "var(--primary)" }}>
          <div className="panel__head">
            <div>
              <div className="panel__title">
                <Clock size={15} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px", color: "var(--primary)" }} />
                Solicitações pendentes ({requestsData.requests.length})
              </div>
              <div className="panel__sub">Empresas aguardando configuração do Bot WhatsApp</div>
            </div>
          </div>
          <div className="panel__body panel__body--flush">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Responsável</th>
                  <th>Número</th>
                  <th>Solicitado</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {requestsData.requests.map((r) => (
                  <tr key={r.companyId}>
                    <td>
                      <strong>{r.companyName}</strong>
                    </td>
                    <td>
                      <div>{r.adminName || "—"}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>{r.adminEmail}</div>
                    </td>
                    <td>
                      <code style={{ fontSize: 13 }}>{r.phone}</code>
                      {r.notes ? <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{r.notes}</div> : null}
                    </td>
                    <td style={{ color: "var(--muted)", fontSize: 12 }}>{relativeTime(r.requestedAt)}</td>
                    <td>
                      <SAStatusDot
                        status={r.status === "pending" ? "TRIALING" : r.status === "done" ? "ACTIVE" : "SUSPENDED"}
                        label={r.status === "pending" ? "Pendente" : r.status === "in_progress" ? "Em andamento" : "Concluído"}
                      />
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <a href={`https://wa.me/${r.phone}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                          WhatsApp
                        </a>
                        {r.status === "pending" ? (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => updateRequest(r.companyId, "in_progress")} disabled={busy}>
                            Em andamento
                          </button>
                        ) : null}
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => updateRequest(r.companyId, "done")} disabled={busy}>
                          Concluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="tbl-filter">
          <div className="grow">
            <Search size={15} />
            <input type="search" placeholder="Buscar empresa ou instância…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {FILTERS.map((f) => (
            <button key={f.key} type="button" className={`chip-tab ${filter === f.key ? "is-on" : ""}`} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>

        <div className="panel__body panel__body--flush">
          {filtered.length === 0 ? (
            <SAEmpty icon={<MessageCircle size={24} />} title="Nenhuma instância" message="Ajuste a busca ou o filtro." />
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Empresa / Instância</th>
                  <th>Sinal</th>
                  <th>Conversas (24h)</th>
                  <th>Lembretes (24h)</th>
                  <th>Última atividade</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => {
                  const s = connState(i);
                  return (
                    <tr key={i.id}>
                      <td>
                        <SABiz name={i.companyName} sub={i.whatsappInstance ?? "sem instância"} seed={i.companyId} />
                      </td>
                      <td>
                        <SASignal level={s.level} />
                      </td>
                      <td className="num">{num(i.stats.conversations24h)}</td>
                      <td className="num">{num(i.stats.reminders24h)}</td>
                      <td style={{ color: "var(--muted)", fontSize: 12 }}>{relativeTime(i.updatedAt)}</td>
                      <td>
                        <SAStatusDot status={s.status} label={s.label} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  );
}
