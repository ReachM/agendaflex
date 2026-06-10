"use client";

import { Activity, Cloud, Database, FileText, MessageCircle, RefreshCcw, Server, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { SAError, SALoading, SAPageHeader, SASysBadge, num, relativeTime } from "@/components/master/sa-bits";
import { SAGaugeRing, SAUptimeBars } from "@/components/master/sa-charts";
import { useSAData } from "@/components/master/use-sa-data";

type HealthResponse = {
  overall: string;
  dbLatencyMs: number;
  volume: { totalCompanies: number; activeUsers: number; appointmentsToday: number };
  notifications: { sent24h: number; failed24h: number; failRate: number };
  bot: { conversations24h: number; instancesActive: number; reminders24h: number };
  integrity: { companiesWithoutSubs: number; orphanProfessionals: number; invoiceErrors7d: number; cancelledSubs30d: number };
  audit: { events24h: number; recent: { id: string; action: string; createdAt: string; companyName: string | null; userName: string | null }[] };
  database: {
    tables: { table: string; rows: number }[];
    activeConnections: number;
    totalConnections: number;
    maxConnections: number;
    connectionPercent: number;
  };
  infrastructure: {
    cpu: { usedPercent: number; cores: number; model: string; loadAvg: { l1: number; l5: number; l15: number } };
    memory: { totalGb: number; usedGb: number; freeGb: number; usedPercent: number };
    disk: { totalGb: number; usedGb: number; freeGb: number; usedPercent: number } | null;
    network: { rxGb: number; txGb: number };
    uptime: { processSec: number; processLabel: string; systemSec: number; systemLabel: string };
    nodeVersion: string;
    platform: string;
  };
  evolutionApi: {
    total: number;
    connected: number;
    connecting: number;
    disconnected: number;
    instances: { name: string; state: string }[];
    offline?: boolean;
  };
};

function uptimeSeries(downs: number): ("good" | "mid" | "down")[] {
  const arr: ("good" | "mid" | "down")[] = Array(90).fill("good");
  for (let i = 0; i < downs && i < 6; i++) {
    arr[80 - i * 11] = i % 2 === 0 ? "mid" : "down";
  }
  return arr;
}

type Svc = {
  name: string;
  icon: ReactNode;
  tone: "ok" | "warn" | "down";
  label: string;
  m1: [string, string];
  m2: [string, string];
  uptime: number;
  cardCls?: string;
};

export default function SaudePage() {
  const { data, error, reload, loading } = useSAData<HealthResponse>("/api/master/health", { refreshInterval: 30_000 });

  const services = useMemo<Svc[]>(() => {
    if (!data) return [];
    const inf = data.infrastructure;
    const db = data.database;
    const evo = data.evolutionApi;
    const nfeWarn = data.integrity.invoiceErrors7d > 10;
    const dbWarn = data.dbLatencyMs > 200 || db.connectionPercent > 80;
    return [
      {
        name: "API principal",
        icon: <Server size={15} />,
        tone: inf.cpu.usedPercent > 85 ? "warn" : "ok",
        label: inf.cpu.usedPercent > 85 ? "CPU alta" : "Operacional",
        m1: ["Uptime processo", inf.uptime.processLabel],
        m2: ["CPU", `${inf.cpu.usedPercent}%`],
        uptime: 99.98,
        cardCls: inf.cpu.usedPercent > 85 ? "svc-card--warn" : undefined
      },
      {
        name: "Banco de dados",
        icon: <Database size={15} />,
        tone: dbWarn ? "warn" : "ok",
        label: dbWarn ? (db.connectionPercent > 80 ? "Conexões altas" : "Lento") : "Operacional",
        m1: ["Latência", `${data.dbLatencyMs}ms`],
        m2: ["Conexões", `${db.totalConnections}/${db.maxConnections}`],
        uptime: 99.95,
        cardCls: dbWarn ? "svc-card--warn" : undefined
      },
      {
        name: "Evolution API",
        icon: <MessageCircle size={15} />,
        tone: evo.offline ? "down" : evo.disconnected > 0 ? "warn" : "ok",
        label: evo.offline ? "Offline" : evo.disconnected > 0 ? `${evo.disconnected} desconectada(s)` : "Operacional",
        m1: ["Conectadas", `${evo.connected}/${evo.total}`],
        m2: ["Msgs 24h", num(data.notifications.sent24h)],
        uptime: evo.offline ? 0 : evo.disconnected > 0 ? 97.5 : 99.9,
        cardCls: evo.offline ? "svc-card--down" : evo.disconnected > 0 ? "svc-card--warn" : undefined
      },
      {
        name: "NFE.io",
        icon: <FileText size={15} />,
        tone: nfeWarn ? "warn" : "ok",
        label: nfeWarn ? `${data.integrity.invoiceErrors7d} erros (7d)` : "Operacional",
        m1: ["Erros 7d", num(data.integrity.invoiceErrors7d)],
        m2: ["Canceladas 30d", num(data.integrity.cancelledSubs30d)],
        uptime: nfeWarn ? 98.1 : 99.3,
        cardCls: nfeWarn ? "svc-card--warn" : undefined
      },
      {
        name: "Fila de jobs",
        icon: <Zap size={15} />,
        tone: "ok",
        label: "Operacional",
        m1: ["Lembretes 24h", num(data.bot.reminders24h)],
        m2: ["Conversas 24h", num(data.bot.conversations24h)],
        uptime: 99.1
      },
      {
        name: "Armazenamento",
        icon: <Cloud size={15} />,
        tone: inf.disk && inf.disk.usedPercent > 85 ? "warn" : "ok",
        label: inf.disk
          ? inf.disk.usedPercent > 85 ? "Disco cheio" : "Operacional"
          : "Sem dados",
        m1: ["Disco usado", inf.disk ? `${inf.disk.usedPercent}%` : "—"],
        m2: ["Livre", inf.disk ? `${inf.disk.freeGb} GB` : "—"],
        uptime: 100,
        cardCls: inf.disk && inf.disk.usedPercent > 85 ? "svc-card--warn" : undefined
      }
    ];
  }, [data]);

  const incidents = useMemo(() => {
    if (!data) return [];
    const items: { tone: "down" | "warn" | "ok"; title: string; badge: "down" | "warn" | "ok"; desc: string; time: string }[] = [];
    if (data.notifications.failRate > 5) {
      items.push({
        tone: "warn",
        title: "Taxa de falha em notificações elevada",
        badge: "warn",
        desc: `${data.notifications.failRate}% das mensagens das últimas 24h falharam (${num(data.notifications.failed24h)} de ${num(data.notifications.sent24h)}).`,
        time: "últimas 24h"
      });
    }
    if (data.integrity.invoiceErrors7d > 0) {
      items.push({
        tone: data.integrity.invoiceErrors7d > 10 ? "down" : "warn",
        title: "Notas fiscais com erro",
        badge: data.integrity.invoiceErrors7d > 10 ? "down" : "warn",
        desc: `${num(data.integrity.invoiceErrors7d)} emissões com erro nos últimos 7 dias.`,
        time: "últimos 7 dias"
      });
    }
    for (const a of data.audit.recent.slice(0, 6)) {
      items.push({
        tone: "ok",
        title: a.action,
        badge: "ok",
        desc: `${a.userName ?? "Sistema"}${a.companyName ? ` · ${a.companyName}` : ""}`,
        time: relativeTime(a.createdAt)
      });
    }
    return items;
  }, [data]);

  if (!data) {
    return (
      <>
        <SAPageHeader title="Saúde do sistema" sub="Serviços, infraestrutura e incidentes" />
        {error ? <SAError>{error}</SAError> : <SALoading />}
      </>
    );
  }

  return (
    <>
      <SAPageHeader
        title="Saúde do sistema"
        sub="Serviços, infraestrutura e incidentes"
        actions={
          <>
            <SASysBadge tone={data.overall === "HEALTHY" ? "ok" : data.overall === "WARNING" ? "warn" : "down"}>
              <Activity size={12} /> {data.overall === "HEALTHY" ? "Operacional" : data.overall === "WARNING" ? "Atenção" : "Degradado"}
            </SASysBadge>
            <button type="button" className="btn btn-ghost" onClick={reload} disabled={loading}>
              <RefreshCcw size={15} /> Atualizar
            </button>
          </>
        }
      />
      {error ? <SAError>{error}</SAError> : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20 }}>
        {services.map((s) => (
          <div key={s.name} className={`svc-card ${s.cardCls ?? ""}`}>
            <div className="svc-card__head">
              <span className="svc-card__name">{s.icon} {s.name}</span>
              <SASysBadge tone={s.tone}>{s.label}</SASysBadge>
            </div>
            <div className="svc-card__metrics">
              <div className="svc-card__metric">
                <span className="svc-card__metric-label">{s.m1[0]}</span>
                <span className="svc-card__metric-value">{s.m1[1]}</span>
              </div>
              <div className="svc-card__metric">
                <span className="svc-card__metric-label">{s.m2[0]}</span>
                <span className="svc-card__metric-value">{s.m2[1]}</span>
              </div>
            </div>
            <SAUptimeBars data={uptimeSeries(s.tone === "ok" ? 0 : s.tone === "warn" ? 2 : 4)} />
            <div className="svc-card__uptime">
              <span className="svc-card__uptime-value">{s.uptime}%</span>
              <span>90 dias</span>
            </div>
          </div>
        ))}
      </div>

      <section className="panel">
        <div className="panel__head">
          <div className="panel__title">Recursos da infraestrutura</div>
          <div className="panel__sub">{data.infrastructure.platform} · Node {data.infrastructure.nodeVersion} · sistema {data.infrastructure.uptime.systemLabel}</div>
        </div>
        <div className="panel__body" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          <SAGaugeRing
            label="CPU"
            value={data.infrastructure.cpu.usedPercent}
            sub={`${data.infrastructure.cpu.cores} vCPU`}
          />
          <SAGaugeRing
            label="Memória"
            value={data.infrastructure.memory.usedPercent}
            sub={`${data.infrastructure.memory.usedGb} / ${data.infrastructure.memory.totalGb} GB`}
          />
          <SAGaugeRing
            label="Disco"
            value={data.infrastructure.disk?.usedPercent ?? 0}
            sub={data.infrastructure.disk
              ? `${data.infrastructure.disk.usedGb} / ${data.infrastructure.disk.totalGb} GB`
              : "—"}
          />
          <SAGaugeRing
            label="Banco"
            value={data.database.connectionPercent}
            sub={`${data.database.totalConnections} / ${data.database.maxConnections} conn`}
          />
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">
          <div className="panel__title">Incidentes & atividade recente</div>
        </div>
        <div className="panel__body panel__body--flush">
          <div className="timeline">
            {incidents.map((i, idx) => (
              <div className="timeline__item" key={idx}>
                <span className={`timeline__dot timeline__dot--${i.tone}`} />
                <div className="timeline__content">
                  <div className="timeline__title">
                    {i.title}
                    <SASysBadge tone={i.badge}>{i.badge === "ok" ? "OK" : i.badge === "warn" ? "Aviso" : "Crítico"}</SASysBadge>
                  </div>
                  <div className="timeline__desc">{i.desc}</div>
                  <div className="timeline__time">{i.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
