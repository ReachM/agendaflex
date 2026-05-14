"use client";
import { FileText, Plus, Save, X, Eye, Filter } from "lucide-react";
import { useEffect, useState, FormEvent } from "react";
import { PageHeader } from "@/components/page-header";
import { apiFetch } from "@/lib/client-api";

type AnyRecord = Record<string, any>;

const statusLabels: Record<string, string> = {
  REQUESTED: "Solicitada", UNDER_REVIEW: "Em análise", ISSUED: "Emitida",
  SENT_TO_CUSTOMER: "Enviada", CANCELLED: "Cancelada", NOT_REQUESTED: "Não solicitada"
};
const statusClasses: Record<string, string> = {
  REQUESTED: "warning", UNDER_REVIEW: "status-in-progress", ISSUED: "success",
  SENT_TO_CUSTOMER: "success", CANCELLED: "danger"
};

function formatMoney(v?: any) {
  if (v == null || v === "") return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));
}

export default function NotasFiscaisPage() {
  const [invoices, setInvoices] = useState<AnyRecord[]>([]);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<AnyRecord | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [form, setForm] = useState({ legalName: "", documentNumber: "", email: "", phone: "", address: "", city: "", state: "", zipCode: "", amount: "", notes: "" });

  async function load() {
    try {
      const data = await apiFetch<{ invoices: AnyRecord[] }>("/api/invoice-requests");
      setInvoices(data.invoices);
    } catch (err) { setError((err as Error).message); }
  }
  useEffect(() => { load(); }, []);

  async function submit(e: FormEvent) {
    e.preventDefault(); setError("");
    try {
      await apiFetch("/api/invoice-requests", { method: "POST", body: JSON.stringify({ ...form, amount: Number(form.amount) }) });
      setShowForm(false);
      setForm({ legalName: "", documentNumber: "", email: "", phone: "", address: "", city: "", state: "", zipCode: "", amount: "", notes: "" });
      await load();
    } catch (err) { setError((err as Error).message); }
  }

  const filtered = statusFilter
    ? invoices.filter(inv => inv.status === statusFilter)
    : invoices;

  if (error && invoices.length === 0) {
    return (
      <>
        <PageHeader title="Notas Fiscais" subtitle="Solicitação e controle de notas fiscais" />
        <div className="upgrade-banner"><div className="upgrade-banner__icon"><FileText size={24} /></div><div className="upgrade-banner__text"><strong>Funcionalidade Premium</strong><span>{error}</span></div></div>
      </>
    );
  }

  // Count by status
  const statusCounts: Record<string, number> = {};
  invoices.forEach(inv => { statusCounts[inv.status] = (statusCounts[inv.status] || 0) + 1; });

  return (
    <>
      <PageHeader title="Notas Fiscais" subtitle="Solicitação e controle de notas fiscais" actions={<button className="button" type="button" onClick={() => setShowForm(true)}><Plus size={16} /> Nova Solicitação</button>} />
      {error && <div className="error-box">{error}</div>}

      {/* ─── Status Summary ───────────────────────────── */}
      {invoices.length > 0 && (
        <div className="grid cols-4" style={{ marginBottom: 16 }}>
          {Object.entries(statusCounts).map(([status, count]) => (
            <div
              key={status}
              className="stat-card"
              style={{ cursor: "pointer", opacity: statusFilter && statusFilter !== status ? 0.5 : 1 }}
              onClick={() => setStatusFilter(statusFilter === status ? "" : status)}
            >
              <div className="stat-card__header">
                <div className="stat-card__label">{statusLabels[status] ?? status}</div>
              </div>
              <div className="stat-card__value">{count}</div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Create Form Modal ────────────────────────── */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="toolbar" style={{ marginBottom: 16 }}><h2 className="section-title">Solicitar Nota Fiscal</h2><button className="icon-button secondary" onClick={() => setShowForm(false)} type="button"><X size={16} /></button></div>
            <form className="form-grid" onSubmit={submit}>
              <div className="field"><label>Razão Social / Nome</label><input required value={form.legalName} onChange={e => setForm({ ...form, legalName: e.target.value })} /></div>
              <div className="field"><label>CPF / CNPJ</label><input required value={form.documentNumber} onChange={e => setForm({ ...form, documentNumber: e.target.value })} /></div>
              <div className="field"><label>E-mail</label><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div className="field"><label>Telefone</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="field full"><label>Endereço</label><input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
              <div className="field"><label>Cidade</label><input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
              <div className="field"><label>Estado</label><input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} /></div>
              <div className="field"><label>CEP</label><input value={form.zipCode} onChange={e => setForm({ ...form, zipCode: e.target.value })} /></div>
              <div className="field"><label>Valor (R$)</label><input type="number" step="0.01" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
              <div className="field full"><label>Observações</label><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              <div className="field full"><button className="button" type="submit"><Save size={16} /> Solicitar NF</button></div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Detail Modal ─────────────────────────────── */}
      {selectedInvoice && (
        <div className="modal-overlay" onClick={() => setSelectedInvoice(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="toolbar" style={{ marginBottom: 20 }}>
              <h2 className="section-title">Detalhes da NF</h2>
              <button className="icon-button secondary" onClick={() => setSelectedInvoice(null)} type="button"><X size={16} /></button>
            </div>
            <div className="detail-cards">
              <div className="detail-card detail-card--client">
                <div className="detail-card__icon"><FileText size={20} /></div>
                <div className="detail-card__body">
                  <span className="detail-card__label">Razão Social</span>
                  <strong className="detail-card__value">{selectedInvoice.legalName}</strong>
                  <div className="detail-card__meta">
                    <span>CPF/CNPJ: <strong>{selectedInvoice.documentNumber}</strong></span>
                    {selectedInvoice.email && <span>{selectedInvoice.email}</span>}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <div className="metric-row"><span className="metric-row__label">Valor</span><span className="metric-row__value metric-row__value--primary">{formatMoney(selectedInvoice.amount)}</span></div>
              <div className="metric-row"><span className="metric-row__label">Status</span><span className={`badge ${statusClasses[selectedInvoice.status] ?? ""}`}>{statusLabels[selectedInvoice.status] ?? selectedInvoice.status}</span></div>
              {selectedInvoice.invoiceNumber && <div className="metric-row"><span className="metric-row__label">Nº NF</span><span className="metric-row__value">{selectedInvoice.invoiceNumber}</span></div>}
              {selectedInvoice.address && <div className="metric-row"><span className="metric-row__label">Endereço</span><span className="metric-row__value">{selectedInvoice.address}{selectedInvoice.city ? `, ${selectedInvoice.city}` : ""}{selectedInvoice.state ? ` - ${selectedInvoice.state}` : ""}</span></div>}
              <div className="metric-row"><span className="metric-row__label">Data</span><span className="metric-row__value">{new Date(selectedInvoice.createdAt).toLocaleDateString("pt-BR")}</span></div>
            </div>
            {selectedInvoice.notes && (
              <div style={{ marginTop: 12, padding: "12px 14px", background: "var(--surface-muted)", borderRadius: "var(--radius)", fontSize: 13, color: "var(--text-secondary)" }}>
                <strong style={{ display: "block", marginBottom: 4, fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Observações</strong>
                {selectedInvoice.notes}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Table ────────────────────────────────────── */}
      <section className="table-wrap">
        <table>
          <thead><tr><th>Razão Social</th><th>CPF/CNPJ</th><th>Valor</th><th>Status</th><th>Nº NF</th><th>Data</th><th></th></tr></thead>
          <tbody>
            {filtered.map(inv => (
              <tr key={inv.id} className="clickable-row" onClick={() => setSelectedInvoice(inv)}>
                <td><strong>{inv.legalName}</strong></td>
                <td>{inv.documentNumber}</td>
                <td>{formatMoney(inv.amount)}</td>
                <td><span className={`badge ${statusClasses[inv.status] ?? ""}`}>{statusLabels[inv.status] ?? inv.status}</span></td>
                <td>{inv.invoiceNumber ?? "-"}</td>
                <td>{new Date(inv.createdAt).toLocaleDateString("pt-BR")}</td>
                <td><button className="icon-button secondary" title="Ver detalhes" onClick={e => { e.stopPropagation(); setSelectedInvoice(inv); }} type="button"><Eye size={16} /></button></td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7}><div className="empty-state"><div className="empty-state__icon"><FileText size={28} /></div><h3>Nenhuma nota fiscal {statusFilter ? `com status "${statusLabels[statusFilter]}"` : "solicitada"}</h3></div></td></tr>}
          </tbody>
        </table>
      </section>
    </>
  );
}
