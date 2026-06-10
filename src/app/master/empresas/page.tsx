"use client";

import { Building2, ExternalLink, MoreVertical, PauseCircle, PlayCircle, RefreshCcw, Search, Tag, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  SABiz,
  SAEmpty,
  SAError,
  SAHealthBar,
  SALoading,
  SAMiniKpi,
  SAPageHeader,
  SAPlanTag,
  SAStatusDot,
  brl,
  num,
  relativeTime
} from "@/components/master/sa-bits";
import { useSAData } from "@/components/master/use-sa-data";
import { apiFetch } from "@/lib/client-api";

type Company = {
  id: string;
  name: string;
  slug: string | null;
  segment: string | null;
  plan: string;
  planSlug: string | null;
  mrr: number;
  subStatus: string | null;
  status: string;
  usersCount: number;
  health: "good" | "mid" | "low";
  createdAt: string;
};

type DashboardResponse = {
  metrics: {
    companies: number;
    activeCompanies: number;
    trialingCompanies: number;
    pastDueCompanies: number;
    cancelledLast30: number;
    newCompaniesThisMonth: number;
  };
  companies: Company[];
};

const HEALTH_PCT: Record<string, number> = { good: 88, mid: 58, low: 28 };
const PAGE_SIZE = 12;

type Filter = "all" | "active" | "trial" | "overdue" | "cancelled";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "active", label: "Ativas" },
  { key: "trial", label: "Trial" },
  { key: "overdue", label: "Inadimplentes" },
  { key: "cancelled", label: "Canceladas" }
];

function matchesFilter(c: Company, f: Filter) {
  const s = c.subStatus ?? c.status;
  if (f === "all") return true;
  if (f === "active") return s === "ACTIVE";
  if (f === "trial") return s === "TRIALING";
  if (f === "overdue") return s === "PAST_DUE";
  if (f === "cancelled") return s === "CANCELLED" || s === "INACTIVE";
  return true;
}

export default function EmpresasPage() {
  const router = useRouter();
  const { data, error, loading, reload } = useSAData<DashboardResponse>("/api/master/dashboard");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(1);
  const [menuCompanyId, setMenuCompanyId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const handler = () => setMenuCompanyId(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  async function companyAction(
    companyId: string,
    action: "suspend" | "reactivate" | "cancel" | "change_plan",
    extra?: { planSlug?: string }
  ) {
    const labels = {
      suspend: "Suspender esta empresa? O acesso será bloqueado imediatamente.",
      reactivate: "Reativar esta empresa?",
      cancel: "CANCELAR esta empresa? A assinatura será encerrada.",
      change_plan: `Alterar plano para ${extra?.planSlug}?`
    };
    if (!confirm(labels[action])) return;

    setActionLoading(true);
    try {
      await apiFetch(`/api/master/companies/${companyId}`, {
        method: "PATCH",
        body: JSON.stringify({ action, ...extra })
      });
      setMenuCompanyId(null);
      void reload();
    } catch {
      alert("Erro ao executar ação.");
    } finally {
      setActionLoading(false);
    }
  }

  const filtered = useMemo(() => {
    if (!data) return [];
    let rows = data.companies.filter((c) => matchesFilter(c, filter));
    const term = search.trim().toLowerCase();
    if (term) {
      rows = rows.filter(
        (c) => c.name.toLowerCase().includes(term) || (c.slug ?? "").toLowerCase().includes(term)
      );
    }
    rows = [...rows].sort((a, b) => {
      if (sort === "mrr") return b.mrr - a.mrr;
      if (sort === "users") return b.usersCount - a.usersCount;
      return +new Date(b.createdAt) - +new Date(a.createdAt);
    });
    return rows;
  }, [data, search, filter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const pageRows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  async function impersonate(companyId: string) {
    try {
      const res = await fetch("/api/master/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId })
      });
      if (res.ok) {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      /* ignore */
    }
  }

  if (!data) {
    return (
      <>
        <SAPageHeader title="Empresas" sub="Diretório de todas as empresas da plataforma" />
        {error ? <SAError>{error}</SAError> : <SALoading />}
      </>
    );
  }

  const m = data.metrics;

  return (
    <>
      <SAPageHeader
        title="Empresas"
        sub={`${num(m.companies)} empresas no total`}
        actions={
          <button type="button" className="btn btn-ghost" onClick={reload} disabled={loading}>
            <RefreshCcw size={15} /> Atualizar
          </button>
        }
      />

      {error ? <SAError>{error}</SAError> : null}

      <div className="mini-kpis">
        <SAMiniKpi value={num(m.companies)} label={<><strong>+{m.newCompaniesThisMonth}</strong> no mês</>} />
        <SAMiniKpi value={num(m.trialingCompanies)} label="em trial" variant="sky" />
        <SAMiniKpi value={num(m.pastDueCompanies)} label="inadimplentes" variant="rose" />
        <SAMiniKpi value={num(m.cancelledLast30)} label="canceladas (30d)" />
      </div>

      <section className="panel">
        <div className="tbl-filter">
          <div className="grow">
            <Search size={15} />
            <input
              type="search"
              placeholder="Buscar empresa ou slug…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`chip-tab ${filter === f.key ? "is-on" : ""}`}
              onClick={() => {
                setFilter(f.key);
                setPage(1);
              }}
            >
              {f.label}
            </button>
          ))}
          <select className="chip-tab" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="recent">Mais recentes</option>
            <option value="mrr">Maior MRR</option>
            <option value="users">Mais usuários</option>
          </select>
        </div>

        <div className="panel__body panel__body--flush">
          {pageRows.length === 0 ? (
            <SAEmpty icon={<Building2 size={24} />} title="Nenhuma empresa" message="Ajuste a busca ou o filtro." />
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Plano</th>
                  <th>Segmento</th>
                  <th>Usuários</th>
                  <th>MRR</th>
                  <th style={{ width: 120 }}>Saúde</th>
                  <th>Último acesso</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pageRows.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <SABiz name={c.name} sub={c.slug ?? undefined} seed={c.id} />
                    </td>
                    <td>
                      <SAPlanTag plan={c.planSlug ?? c.plan} />
                    </td>
                    <td style={{ color: "var(--text-secondary)", fontSize: 12.5 }}>{c.segment ?? "—"}</td>
                    <td className="num">{c.usersCount}</td>
                    <td className="money">{brl(c.mrr)}</td>
                    <td>
                      <SAHealthBar value={HEALTH_PCT[c.health]} />
                    </td>
                    <td style={{ color: "var(--muted)", fontSize: 12 }}>{relativeTime(c.createdAt)}</td>
                    <td>
                      <SAStatusDot status={c.subStatus ?? c.status} />
                    </td>
                    <td>
                      <div className="row-actions" style={{ position: "relative" }}>
                        <button type="button" className="row-btn imp" title="Acessar como empresa" onClick={() => impersonate(c.id)}>
                          <ExternalLink size={15} />
                        </button>
                        <button
                          type="button"
                          className="row-btn"
                          title="Mais"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuCompanyId(menuCompanyId === c.id ? null : c.id);
                          }}
                        >
                          <MoreVertical size={15} />
                        </button>
                        {menuCompanyId === c.id ? (
                          <div
                            className="dropdown"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              position: "absolute",
                              right: 0,
                              top: "100%",
                              zIndex: 50,
                              background: "var(--surface)",
                              border: "1px solid var(--border)",
                              borderRadius: "var(--radius)",
                              boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
                              minWidth: 200,
                              padding: 4
                            }}
                          >
                            <div
                              style={{
                                padding: "6px 12px",
                                fontSize: 11,
                                fontWeight: 700,
                                color: "var(--muted)",
                                textTransform: "uppercase",
                                letterSpacing: "0.06em"
                              }}
                            >
                              Alterar plano
                            </div>
                            {["starter", "pro", "max"]
                              .filter((p) => p !== c.plan)
                              .map((p) => (
                                <button
                                  key={p}
                                  type="button"
                                  className="dropdown-item"
                                  disabled={actionLoading}
                                  onClick={() => companyAction(c.id, "change_plan", { planSlug: p })}
                                >
                                  <Tag size={13} /> Mudar para {p.charAt(0).toUpperCase() + p.slice(1)}
                                </button>
                              ))}
                            <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
                            {c.status === "ACTIVE" ? (
                              <button
                                type="button"
                                className="dropdown-item dropdown-item--warn"
                                disabled={actionLoading}
                                onClick={() => companyAction(c.id, "suspend")}
                              >
                                <PauseCircle size={13} /> Suspender acesso
                              </button>
                            ) : c.status === "SUSPENDED" ? (
                              <button
                                type="button"
                                className="dropdown-item"
                                disabled={actionLoading}
                                onClick={() => companyAction(c.id, "reactivate")}
                              >
                                <PlayCircle size={13} /> Reativar empresa
                              </button>
                            ) : null}
                            {c.status !== "INACTIVE" ? (
                              <button
                                type="button"
                                className="dropdown-item dropdown-item--danger"
                                disabled={actionLoading}
                                onClick={() => companyAction(c.id, "cancel")}
                              >
                                <XCircle size={13} /> Cancelar empresa
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {filtered.length > PAGE_SIZE ? (
          <div className="pagination">
            <span>
              {(current - 1) * PAGE_SIZE + 1}–{Math.min(current * PAGE_SIZE, filtered.length)} de {filtered.length}
            </span>
            <div className="pages">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button key={p} type="button" className={p === current ? "is-active" : ""} onClick={() => setPage(p)}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </>
  );
}
