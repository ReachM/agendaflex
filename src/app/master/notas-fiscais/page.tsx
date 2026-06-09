"use client";

import { CheckCircle2, FileText, Loader, RefreshCcw, Search, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import {
  SAEmpty,
  SAError,
  SAKpiCard,
  SALoading,
  SAPageHeader,
  SASysBadge,
  brl,
  formatDate,
  num
} from "@/components/master/sa-bits";
import { SABarChart } from "@/components/master/sa-charts";
import { useSAData } from "@/components/master/use-sa-data";

type Invoice = {
  id: string;
  legalName: string | null;
  documentNumber: string | null;
  amount: number;
  status: string;
  invoiceNumber: string | null;
  issuedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  companyName: string;
  customerName: string | null;
};
type InvoicesResponse = {
  metrics: { total: number; issuedLast30: number; cancelledLast30: number; pending: number; monthlyValueIssued: number };
  statusBreakdown: { status: string; count: number; total: number }[];
  recentInvoices: Invoice[];
};

type Tone = "ok" | "info" | "down";
function statusInfo(status: string, hasError: boolean): { label: string; tone: Tone } {
  if (status === "ISSUED") return { label: "AUTORIZADA", tone: "ok" };
  if (status === "REQUESTED" || status === "UNDER_REVIEW") return { label: "PROCESSANDO", tone: "info" };
  if (hasError || status === "ERROR" || status === "REJECTED") return { label: "ERRO", tone: "down" };
  if (status === "CANCELLED") return { label: "CANCELADA", tone: "down" };
  return { label: status, tone: "info" };
}

type Filter = "all" | "issued" | "processing" | "error";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "issued", label: "Autorizadas" },
  { key: "processing", label: "Processando" },
  { key: "error", label: "Erro" }
];

export default function NotasFiscaisPage() {
  const { data, error, reload, loading } = useSAData<InvoicesResponse>("/api/master/invoices");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const errorCount = useMemo(() => {
    if (!data) return 0;
    return data.statusBreakdown
      .filter((s) => ["ERROR", "REJECTED", "CANCELLED"].includes(s.status))
      .reduce((a, s) => a + s.count, 0);
  }, [data]);

  const authRate = useMemo(() => {
    if (!data) return 0;
    const issued = data.metrics.issuedLast30;
    const denom = issued + errorCount;
    return denom > 0 ? Number(((issued / denom) * 100).toFixed(1)) : 100;
  }, [data, errorCount]);

  const bars = useMemo(() => {
    if (!data) return [];
    return data.statusBreakdown.map((s) => {
      const info = statusInfo(s.status, false);
      const color = info.tone === "ok" ? "#8b5cf6" : info.tone === "down" ? "#fb7185" : "#38bdf8";
      return { label: info.label.slice(0, 4), segments: [{ value: s.count, color }] };
    });
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let rows = data.recentInvoices;
    if (filter === "issued") rows = rows.filter((i) => i.status === "ISSUED");
    else if (filter === "processing") rows = rows.filter((i) => ["REQUESTED", "UNDER_REVIEW"].includes(i.status));
    else if (filter === "error") rows = rows.filter((i) => Boolean(i.errorMessage) || ["ERROR", "REJECTED", "CANCELLED"].includes(i.status));
    const term = search.trim().toLowerCase();
    if (term) {
      rows = rows.filter(
        (i) =>
          (i.invoiceNumber ?? "").toLowerCase().includes(term) ||
          i.companyName.toLowerCase().includes(term) ||
          (i.legalName ?? "").toLowerCase().includes(term)
      );
    }
    return rows;
  }, [data, search, filter]);

  if (!data) {
    return (
      <>
        <SAPageHeader title="Notas fiscais" sub="NFS-e emitidas via NFE.io" />
        {error ? <SAError>{error}</SAError> : <SALoading />}
      </>
    );
  }

  const m = data.metrics;

  return (
    <>
      <SAPageHeader
        title="Notas fiscais"
        sub={`${num(m.total)} notas no total`}
        actions={
          <button type="button" className="btn btn-ghost" onClick={reload} disabled={loading}>
            <RefreshCcw size={15} /> Atualizar
          </button>
        }
      />
      {error ? <SAError>{error}</SAError> : null}

      <div className="kpi-grid">
        <SAKpiCard label="Emitidas (30d)" value={num(m.issuedLast30)} icon={<FileText size={18} />} foot={brl(m.monthlyValueIssued, { compact: true })} />
        <SAKpiCard label="Taxa autorização" value={`${authRate}%`} variant="teal" icon={<CheckCircle2 size={18} />} />
        <SAKpiCard label="Processando" value={num(m.pending)} variant="sky" icon={<Loader size={18} />} />
        <SAKpiCard label="Com erro" value={num(errorCount)} variant="rose" icon={<XCircle size={18} />} />
      </div>

      <section className="panel">
        <div className="panel__head">
          <div className="panel__title">Distribuição por status</div>
        </div>
        <div className="panel__body">{bars.length > 0 ? <SABarChart data={bars} /> : <SALoading />}</div>
      </section>

      <section className="panel">
        <div className="tbl-filter">
          <div className="grow">
            <Search size={15} />
            <input type="search" placeholder="Buscar número, empresa ou razão social…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {FILTERS.map((f) => (
            <button key={f.key} type="button" className={`chip-tab ${filter === f.key ? "is-on" : ""}`} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>

        <div className="panel__body panel__body--flush">
          {filtered.length === 0 ? (
            <SAEmpty icon={<FileText size={24} />} title="Nenhuma nota" message="Ajuste a busca ou o filtro." />
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Empresa</th>
                  <th>Tomador</th>
                  <th>Valor</th>
                  <th>Emissão</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => {
                  const info = statusInfo(i.status, Boolean(i.errorMessage));
                  return (
                    <tr key={i.id}>
                      <td className="num">{i.invoiceNumber ?? "—"}</td>
                      <td style={{ fontWeight: 600 }}>{i.companyName}</td>
                      <td style={{ color: "var(--text-secondary)", fontSize: 12.5 }}>{i.legalName ?? i.customerName ?? "—"}</td>
                      <td className="money">{brl(i.amount)}</td>
                      <td className="num" style={{ color: "var(--muted)" }}>{formatDate(i.issuedAt ?? i.createdAt)}</td>
                      <td>
                        <SASysBadge tone={info.tone}>{info.label}</SASysBadge>
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
