"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Info,
  Loader2,
  Plus,
  Settings2,
  Trash2,
  X
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { apiFetch } from "@/lib/client-api";

type InvoiceStatus = "NOT_REQUESTED" | "REQUESTED" | "UNDER_REVIEW" | "ISSUED" | "SENT_TO_CUSTOMER" | "CANCELLED";

type Invoice = {
  id: string;
  legalName: string;
  documentNumber: string;
  amount: number;
  issAmount: number | null;
  serviceCode: string | null;
  status: InvoiceStatus;
  invoiceNumber: string | null;
  issuedAt: string | null;
  fileUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  customer?: { id: string; name: string } | null;
  appointment?: { id: string; startAt: string } | null;
  requestedBy?: { id: string; name: string } | null;
};

type ListResponse = {
  invoices: Invoice[];
  statusCounts: { status: InvoiceStatus; count: number }[];
  hasEmitterConfig: boolean;
  hasNfeioIntegration: boolean;
  autoEmit: boolean;
};

type Config = {
  id: string;
  cnpj: string;
  legalName: string;
  municipalRegistration: string | null;
  stateRegistration: string | null;
  issRate: number | null;
  serviceCode: string | null;
  taxRegime: string | null;
  nfeioCompanyId: string | null;
  autoEmit: boolean;
  notes: string | null;
};

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  NOT_REQUESTED: "Não solicitada",
  REQUESTED: "Solicitada",
  UNDER_REVIEW: "Processando",
  ISSUED: "Autorizada",
  SENT_TO_CUSTOMER: "Enviada",
  CANCELLED: "Cancelada"
};

const STATUS_CLASS: Record<InvoiceStatus, string> = {
  NOT_REQUESTED: "pill--muted",
  REQUESTED: "pill--info",
  UNDER_REVIEW: "pill--warn",
  ISSUED: "pill--success",
  SENT_TO_CUSTOMER: "pill--success",
  CANCELLED: "pill--cancelled"
};

const TABS: { id: "all" | InvoiceStatus; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "ISSUED", label: "Autorizadas" },
  { id: "UNDER_REVIEW", label: "Processando" },
  { id: "REQUESTED", label: "Solicitadas" },
  { id: "CANCELLED", label: "Canceladas" }
];

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(new Date(value));
}

export default function NotasFiscaisPage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("all");
  const [newOpen, setNewOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [issueDialog, setIssueDialog] = useState<Invoice | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiFetch<ListResponse>(`/api/invoice-requests`);
      setData(result);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visibleInvoices = useMemo(() => {
    if (!data) return [];
    if (tab === "all") return data.invoices;
    return data.invoices.filter(i => i.status === tab);
  }, [data, tab]);

  const counts = useMemo(() => {
    const map = new Map<InvoiceStatus, number>();
    data?.statusCounts.forEach(s => map.set(s.status, s.count));
    return map;
  }, [data]);

  function statusBadge(status: InvoiceStatus) {
    return <span className={`pill ${STATUS_CLASS[status]}`}>{STATUS_LABELS[status]}</span>;
  }

  return (
    <>
      <PageHeader
        title="Notas Fiscais"
        subtitle="Solicitação, emissão e controle"
        actions={
          <>
            {data?.hasEmitterConfig ? (
              data.autoEmit ? (
                <span className="pill pill--success" title="Configuração NFE.io ativa e emissão automática habilitada">
                  <span className="dot-s" /> Emissão automática
                </span>
              ) : (
                <span className="pill pill--warn" title="Emissão manual (configurar NFE.io para automatizar)">
                  <span className="dot-s" /> Emissão manual
                </span>
              )
            ) : (
              <span className="pill pill--muted">Sem emissor configurado</span>
            )}
            <button type="button" className="btn btn-ghost" onClick={() => setConfigOpen(true)}>
              <Settings2 size={15} /> Configurar emissor
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setNewOpen(true)}>
              <Plus size={15} /> Emitir nota
            </button>
          </>
        }
      />

      {error ? <div className="error-box">{error}</div> : null}

      {!data?.hasEmitterConfig ? (
        <div className="upgrade-banner" style={{ marginBottom: 16 }}>
          <div className="upgrade-banner__icon"><AlertTriangle size={28} /></div>
          <div className="upgrade-banner__text">
            <strong>Configure o emissor antes de emitir notas</strong>
            <span>Cadastre CNPJ, inscrição municipal e dados fiscais em &ldquo;Configurar emissor&rdquo;.</span>
          </div>
          <button type="button" className="btn btn-amber" onClick={() => setConfigOpen(true)}>Configurar agora</button>
        </div>
      ) : null}

      {data && data.hasEmitterConfig && !data.hasNfeioIntegration ? (
        <div
          className="info-banner"
          style={{
            background: "var(--info-light)",
            border: "1px solid var(--info)",
            borderRadius: "var(--radius-lg)",
            padding: "14px 18px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 20
          }}
        >
          <Info size={18} style={{ color: "var(--info)", flexShrink: 0 }} />
          <div>
            <strong>Emissão automática não configurada</strong>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--muted)" }}>
              As notas podem ser emitidas manualmente e o status atualizado aqui.
              A emissão automática via NFE.io estará disponível em breve.
            </p>
          </div>
        </div>
      ) : null}

      {loading && !data ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <div className="loading-spinner" />
        </div>
      ) : data ? (
        <>
          <div className="grid cols-4" style={{ marginBottom: 16 }}>
            <SmallStat label="Autorizadas" value={counts.get("ISSUED") ?? 0} icon={<CheckCircle2 size={20} />} variant="success" />
            <SmallStat label="Processando" value={counts.get("UNDER_REVIEW") ?? 0} icon={<Loader2 size={20} />} variant="warning" />
            <SmallStat label="Solicitadas" value={counts.get("REQUESTED") ?? 0} icon={<FileText size={20} />} variant="info" />
            <SmallStat label="Canceladas" value={counts.get("CANCELLED") ?? 0} icon={<X size={20} />} variant="danger" />
          </div>

          <div className="panel">
            <div className="panel__head" style={{ flexDirection: "column", alignItems: "stretch", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div className="panel__title">Notas fiscais</div>
                  <div className="panel__sub">{visibleInvoices.length} notas exibidas</div>
                </div>
                <div className="tabs">
                  {TABS.map(t => (
                    <button key={t.id} type="button" className={`tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="panel__body panel__body--flush">
              {visibleInvoices.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state__icon"><FileText size={24} /></div>
                  <h3>Nenhuma nota neste filtro</h3>
                  <p>Comece emitindo a primeira nota fiscal pelo botão acima.</p>
                </div>
              ) : (
                <div className="table-wrap" style={{ borderRadius: 0, border: 0, boxShadow: "none" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Tomador</th>
                        <th className="col-hide-mobile">Documento</th>
                        <th>Número NF</th>
                        <th className="col-hide-mobile">Data</th>
                        <th>Status</th>
                        <th style={{ textAlign: "right" }}>Valor</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleInvoices.map(i => (
                        <tr key={i.id}>
                          <td>
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              <strong style={{ fontSize: 13 }}>{i.legalName}</strong>
                              {i.customer?.name ? <span className="muted" style={{ fontSize: 11 }}>{i.customer.name}</span> : null}
                              {i.errorMessage ? <span style={{ color: "var(--danger)", fontSize: 11 }}>{i.errorMessage}</span> : null}
                            </div>
                          </td>
                          <td className="col-hide-mobile">{i.documentNumber}</td>
                          <td>{i.invoiceNumber ?? "—"}</td>
                          <td className="col-hide-mobile">{formatDate(i.issuedAt ?? i.createdAt)}</td>
                          <td>{statusBadge(i.status)}</td>
                          <td style={{ textAlign: "right", fontWeight: 700 }}>{formatMoney(i.amount)}</td>
                          <td style={{ textAlign: "right" }}>
                            <div style={{ display: "inline-flex", gap: 6 }}>
                              {i.fileUrl ? (
                                <a className="btn btn-sm btn-ghost" href={i.fileUrl} target="_blank" rel="noreferrer">
                                  <Download size={13} />
                                </a>
                              ) : null}
                              {i.status !== "ISSUED" && i.status !== "SENT_TO_CUSTOMER" && i.status !== "CANCELLED" ? (
                                <button type="button" className="btn btn-sm btn-primary" onClick={() => setIssueDialog(i)}>
                                  Marcar emitida
                                </button>
                              ) : null}
                              {i.status !== "CANCELLED" ? (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-danger-ghost"
                                  onClick={async () => {
                                    if (!confirm("Cancelar esta nota fiscal?")) return;
                                    try {
                                      await apiFetch(`/api/invoice-requests/${i.id}`, { method: "DELETE" });
                                      void load();
                                    } catch (err) {
                                      setError((err as Error).message);
                                    }
                                  }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}

      {newOpen ? <NewInvoiceModal onClose={() => setNewOpen(false)} onSaved={() => { setNewOpen(false); void load(); }} /> : null}
      {configOpen ? <ConfigModal onClose={() => setConfigOpen(false)} onSaved={() => { setConfigOpen(false); void load(); }} /> : null}
      {issueDialog ? (
        <MarkIssuedModal
          invoice={issueDialog}
          onClose={() => setIssueDialog(null)}
          onSaved={() => { setIssueDialog(null); void load(); }}
        />
      ) : null}
    </>
  );
}

function SmallStat({ label, value, icon, variant }: {
  label: string; value: number; icon: React.ReactNode;
  variant: "success" | "danger" | "info" | "warning";
}) {
  const cls: Record<string, string> = {
    success: "stat-card--success",
    danger: "stat-card--danger",
    info: "stat-card--info",
    warning: "stat-card--warning"
  };
  return (
    <div className={`stat-card ${cls[variant]}`}>
      <div className="stat-card__header">
        <div>
          <div className="stat-card__label">{label}</div>
          <div className="stat-card__value">{value}</div>
        </div>
        <div className="stat-card__icon">{icon}</div>
      </div>
    </div>
  );
}

function NewInvoiceModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [legalName, setLegalName] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [serviceCode, setServiceCode] = useState("");
  const [issAmount, setIssAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      await apiFetch("/api/invoice-requests", {
        method: "POST",
        body: JSON.stringify({
          legalName,
          documentNumber,
          email: email || null,
          phone: phone || null,
          amount: Number(amount.replace(/\./g, "").replace(",", ".")),
          issAmount: issAmount ? Number(issAmount.replace(/\./g, "").replace(",", ".")) : null,
          serviceCode: serviceCode || null,
          notes: notes || null
        })
      });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div className="preview-modal__header">
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Emitir nota fiscal</h2>
          <button type="button" className="icon-button secondary" onClick={onClose} aria-label="Fechar"><X size={16} /></button>
        </div>

        {error ? <div className="error-box" style={{ marginTop: 16 }}>{error}</div> : null}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16, marginTop: 16 }}>
          <div className="form-grid">
            <div className="field full">
              <label>Razão social / Nome *</label>
              <input className="input" required value={legalName} onChange={e => setLegalName(e.target.value)} />
            </div>
            <div className="field">
              <label>CPF / CNPJ *</label>
              <input className="input" required value={documentNumber} onChange={e => setDocumentNumber(e.target.value)} placeholder="00.000.000/0001-00" />
            </div>
            <div className="field">
              <label>E-mail</label>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <label>Telefone</label>
              <input className="input" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div className="field">
              <label>Valor *</label>
              <input className="input" required inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" />
            </div>
            <div className="field">
              <label>Valor ISS</label>
              <input className="input" inputMode="decimal" value={issAmount} onChange={e => setIssAmount(e.target.value)} placeholder="0,00" />
            </div>
            <div className="field">
              <label>Código do serviço</label>
              <input className="input" value={serviceCode} onChange={e => setServiceCode(e.target.value)} placeholder="Ex.: 1401" />
            </div>
            <div className="field full">
              <label>Observações</label>
              <textarea className="textarea" rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Enviando..." : "Solicitar emissão"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfigModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<{ config: Config | null }>("/api/invoice-config")
      .then(r => setConfig(r.config ?? {
        id: "", cnpj: "", legalName: "", municipalRegistration: null, stateRegistration: null,
        issRate: null, serviceCode: null, taxRegime: null, nfeioCompanyId: null,
        autoEmit: false, notes: null
      }))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!config) return;
    setSaving(true); setError("");
    try {
      await apiFetch("/api/invoice-config", {
        method: "PUT",
        body: JSON.stringify({
          cnpj: config.cnpj,
          legalName: config.legalName,
          municipalRegistration: config.municipalRegistration,
          stateRegistration: config.stateRegistration,
          issRate: config.issRate,
          serviceCode: config.serviceCode,
          taxRegime: config.taxRegime,
          nfeioCompanyId: config.nfeioCompanyId,
          autoEmit: config.autoEmit,
          notes: config.notes
        })
      });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div className="preview-modal__header">
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Configurar emissor</h2>
          <button type="button" className="icon-button secondary" onClick={onClose} aria-label="Fechar"><X size={16} /></button>
        </div>

        {error ? <div className="error-box" style={{ marginTop: 16 }}>{error}</div> : null}

        {loading || !config ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><div className="loading-spinner" /></div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16, marginTop: 16 }}>
            <div className="form-grid">
              <div className="field">
                <label>CNPJ *</label>
                <input className="input" required value={config.cnpj} onChange={e => setConfig({ ...config, cnpj: e.target.value })} placeholder="00.000.000/0001-00" />
              </div>
              <div className="field">
                <label>Razão social *</label>
                <input className="input" required value={config.legalName} onChange={e => setConfig({ ...config, legalName: e.target.value })} />
              </div>
              <div className="field">
                <label>Inscrição municipal</label>
                <input className="input" value={config.municipalRegistration ?? ""} onChange={e => setConfig({ ...config, municipalRegistration: e.target.value || null })} />
              </div>
              <div className="field">
                <label>Inscrição estadual</label>
                <input className="input" value={config.stateRegistration ?? ""} onChange={e => setConfig({ ...config, stateRegistration: e.target.value || null })} />
              </div>
              <div className="field">
                <label>Alíquota ISS (%)</label>
                <input className="input" inputMode="decimal" value={config.issRate ?? ""} onChange={e => setConfig({ ...config, issRate: e.target.value ? Number(e.target.value) : null })} />
              </div>
              <div className="field">
                <label>Código serviço padrão</label>
                <input className="input" value={config.serviceCode ?? ""} onChange={e => setConfig({ ...config, serviceCode: e.target.value || null })} />
              </div>
              <div className="field">
                <label>Regime tributário</label>
                <select className="select" value={config.taxRegime ?? ""} onChange={e => setConfig({ ...config, taxRegime: e.target.value || null })}>
                  <option value="">—</option>
                  <option value="SIMPLES">Simples Nacional</option>
                  <option value="NORMAL">Normal</option>
                </select>
              </div>
              <div className="field full">
                <label>NFE.io company ID</label>
                <input className="input" value={config.nfeioCompanyId ?? ""} readOnly placeholder="Gerado automaticamente ao salvar os dados fiscais" />
                <small className="hint">Cadastro feito automaticamente na NFE.io quando você salva os dados fiscais. Nenhuma chave é necessária aqui.</small>
              </div>
              <div className="field full">
                <label className="checkbox-line">
                  <input type="checkbox" checked={config.autoEmit} onChange={e => setConfig({ ...config, autoEmit: e.target.checked })} />
                  <span>Tentar emissão automática via NFE.io ao criar uma nova nota</span>
                </label>
              </div>
              <div className="field full">
                <label>Observações</label>
                <textarea className="textarea" rows={3} value={config.notes ?? ""} onChange={e => setConfig({ ...config, notes: e.target.value || null })} />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Salvando..." : "Salvar configuração"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function MarkIssuedModal({ invoice, onClose, onSaved }: { invoice: Invoice; onClose: () => void; onSaved: () => void }) {
  const [invoiceNumber, setInvoiceNumber] = useState(invoice.invoiceNumber ?? "");
  const [fileUrl, setFileUrl] = useState(invoice.fileUrl ?? "");
  const [issuedAt, setIssuedAt] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      await apiFetch(`/api/invoice-requests/${invoice.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "ISSUED",
          invoiceNumber: invoiceNumber || null,
          fileUrl: fileUrl || null,
          issuedAt
        })
      });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
        <div className="preview-modal__header">
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Marcar como emitida</h2>
          <button type="button" className="icon-button secondary" onClick={onClose} aria-label="Fechar"><X size={16} /></button>
        </div>

        <p className="muted" style={{ marginTop: 12 }}>
          Tomador: <strong>{invoice.legalName}</strong> · Valor: <strong>{formatMoney(invoice.amount)}</strong>
        </p>

        {error ? <div className="error-box">{error}</div> : null}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16, marginTop: 8 }}>
          <div className="field">
            <label>Número da NF *</label>
            <input className="input" required value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="Ex.: 000123" />
          </div>
          <div className="field">
            <label>Data de emissão</label>
            <input className="input" type="date" value={issuedAt} onChange={e => setIssuedAt(e.target.value)} />
          </div>
          <div className="field">
            <label>Link do PDF (opcional)</label>
            <input className="input" type="url" value={fileUrl} onChange={e => setFileUrl(e.target.value)} placeholder="https://..." />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Salvando..." : "Confirmar emissão"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
