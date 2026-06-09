"use client";

import { MessageCircle, RefreshCcw, Search, Wifi } from "lucide-react";
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
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

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
          <button type="button" className="btn btn-ghost" onClick={reload} disabled={loading}>
            <RefreshCcw size={15} /> Atualizar
          </button>
        }
      />
      {error ? <SAError>{error}</SAError> : null}

      <div className="mini-kpis">
        <SAMiniKpi value={num(connected)} label="conectadas" icon={<Wifi size={18} />} variant="teal" />
        <SAMiniKpi value={num(waiting)} label="aguardando QR" icon={<MessageCircle size={18} />} variant="sky" />
        <SAMiniKpi value={num(disconnected)} label="desconectadas" icon={<MessageCircle size={18} />} variant="rose" />
        <SAMiniKpi value={num(m.totalReminders24h)} label="msgs / 24h" icon={<MessageCircle size={18} />} />
      </div>

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
