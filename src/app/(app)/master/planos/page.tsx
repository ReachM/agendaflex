"use client";
import { Check, CreditCard, Edit2, Plus, Save, ToggleLeft, ToggleRight, X } from "lucide-react";
import { useEffect, useState, FormEvent } from "react";
import { PageHeader } from "@/components/page-header";
import { apiFetch } from "@/lib/client-api";

type AnyRecord = Record<string, any>;

function formatMoney(v?: any) {
  if (v == null) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));
}

const boolFeatures = [
  ["allowClientSelfScheduling", "Agendamento público"],
  ["allowAdvancedReports", "Relatórios avançados"],
  ["allowFinancialControl", "Controle financeiro"],
  ["allowInvoiceRequest", "Nota fiscal"],
  ["allowCustomerChecklist", "Checklist/Via cliente"],
  ["allowAuditLogs", "Logs de auditoria"],
  ["allowCustomFields", "Campos personalizados"],
  ["allowMultipleServicesPerAppointment", "Múltiplos serviços por agendamento"]
] as const;

const defaultForm = {
  name: "", slug: "", description: "", price: "0", maxUsers: "3", maxProfessionals: "5",
  maxCustomers: "100", maxAppointmentsPerMonth: "200",
  allowClientSelfScheduling: false, allowAdvancedReports: false, allowFinancialControl: false,
  allowInvoiceRequest: false, allowCustomerChecklist: false, allowAuditLogs: true,
  allowCustomFields: true, allowMultipleServicesPerAppointment: true, isActive: true, sortOrder: "0"
};

export default function MasterPlanosPage() {
  const [plans, setPlans] = useState<AnyRecord[]>([]);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<AnyRecord | null>(null);
  const [form, setForm] = useState({ ...defaultForm });
  const [saving, setSaving] = useState(false);

  async function load() {
    try { const data = await apiFetch<{ plans: AnyRecord[] }>("/api/plans"); setPlans(data.plans); }
    catch (err) { setError((err as Error).message); }
  }
  useEffect(() => { load(); }, []);

  function openCreate() {
    setForm({ ...defaultForm });
    setEditingPlan(null);
    setShowForm(true);
    setError("");
  }

  function openEdit(plan: AnyRecord) {
    setEditingPlan(plan);
    setForm({
      name: plan.name ?? "", slug: plan.slug ?? "", description: plan.description ?? "",
      price: plan.price != null ? String(plan.price) : "0",
      maxUsers: String(plan.maxUsers ?? 3), maxProfessionals: String(plan.maxProfessionals ?? 5),
      maxCustomers: String(plan.maxCustomers ?? 100), maxAppointmentsPerMonth: String(plan.maxAppointmentsPerMonth ?? 200),
      allowClientSelfScheduling: plan.allowClientSelfScheduling ?? false,
      allowAdvancedReports: plan.allowAdvancedReports ?? false,
      allowFinancialControl: plan.allowFinancialControl ?? false,
      allowInvoiceRequest: plan.allowInvoiceRequest ?? false,
      allowCustomerChecklist: plan.allowCustomerChecklist ?? false,
      allowAuditLogs: plan.allowAuditLogs ?? true,
      allowCustomFields: plan.allowCustomFields ?? true,
      allowMultipleServicesPerAppointment: plan.allowMultipleServicesPerAppointment ?? true,
      isActive: plan.isActive ?? true,
      sortOrder: String(plan.sortOrder ?? 0)
    });
    setShowForm(true);
    setError("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault(); setError(""); setSaving(true);
    try {
      const payload = {
        ...form, price: Number(form.price), maxUsers: Number(form.maxUsers),
        maxProfessionals: Number(form.maxProfessionals), maxCustomers: Number(form.maxCustomers),
        maxAppointmentsPerMonth: Number(form.maxAppointmentsPerMonth), sortOrder: Number(form.sortOrder)
      };

      if (editingPlan) {
        await apiFetch(`/api/plans/${editingPlan.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await apiFetch("/api/plans", { method: "POST", body: JSON.stringify(payload) });
      }
      setShowForm(false);
      setEditingPlan(null);
      await load();
    } catch (err) { setError((err as Error).message); }
    finally { setSaving(false); }
  }

  async function toggleActive(plan: AnyRecord) {
    setError("");
    try {
      await apiFetch(`/api/plans/${plan.id}`, {
        method: "PATCH", body: JSON.stringify({ isActive: !plan.isActive })
      });
      await load();
    } catch (err) { setError((err as Error).message); }
  }

  return (
    <>
      <PageHeader title="Planos" subtitle="Planos SaaS da plataforma" actions={<button className="button" onClick={openCreate} type="button"><Plus size={16} /> Novo Plano</button>} />
      {error && <div className="error-box">{error}</div>}

      {showForm && (
        <div className="modal-overlay" onClick={() => { setShowForm(false); setEditingPlan(null); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="toolbar" style={{ marginBottom: 16 }}>
              <h2 className="section-title">{editingPlan ? "Editar Plano" : "Novo Plano"}</h2>
              <button className="icon-button secondary" onClick={() => { setShowForm(false); setEditingPlan(null); }} type="button"><X size={16} /></button>
            </div>
            <form className="form-grid" onSubmit={submit}>
              <div className="field"><label>Nome</label><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div className="field"><label>Slug</label><input required value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="ex: enterprise" disabled={!!editingPlan} /></div>
              <div className="field"><label>Preço (R$)</label><input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></div>
              <div className="field"><label>Ordem</label><input type="number" value={form.sortOrder} onChange={e => setForm({ ...form, sortOrder: e.target.value })} /></div>
              <div className="field"><label>Máx. Usuários</label><input type="number" value={form.maxUsers} onChange={e => setForm({ ...form, maxUsers: e.target.value })} /></div>
              <div className="field"><label>Máx. Profissionais</label><input type="number" value={form.maxProfessionals} onChange={e => setForm({ ...form, maxProfessionals: e.target.value })} /></div>
              <div className="field"><label>Máx. Clientes</label><input type="number" value={form.maxCustomers} onChange={e => setForm({ ...form, maxCustomers: e.target.value })} /></div>
              <div className="field"><label>Máx. Agendamentos/Mês</label><input type="number" value={form.maxAppointmentsPerMonth} onChange={e => setForm({ ...form, maxAppointmentsPerMonth: e.target.value })} /></div>
              <div className="field full"><label>Descrição</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <div className="field full" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {boolFeatures.map(([key, label]) => (
                  <div key={key} className="checkbox-line"><input type="checkbox" checked={(form as any)[key]} onChange={e => setForm({ ...form, [key]: e.target.checked })} /><label>{label}</label></div>
                ))}
              </div>
              {editingPlan && (
                <div className="field full">
                  <div className="checkbox-line"><input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} /><label>Plano ativo</label></div>
                </div>
              )}
              <div className="field full"><button className="button" type="submit" disabled={saving}><Save size={16} /> {saving ? "Salvando..." : editingPlan ? "Salvar Alterações" : "Criar Plano"}</button></div>
            </form>
          </div>
        </div>
      )}

      <div className="grid cols-3">
        {plans.map(plan => (
          <section key={plan.id} className={`panel ${!plan.isActive ? "plan-inactive" : ""}`} style={{ position: "relative", opacity: plan.isActive ? 1 : 0.65 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h2 className="section-title">{plan.name}</h2>
                <span className="muted">{plan.slug}</span>
                {!plan.isActive && <span className="badge danger" style={{ marginLeft: 8 }}>Inativo</span>}
              </div>
              <strong style={{ fontSize: 20, color: "var(--primary)" }}>{formatMoney(plan.price)}<span className="muted" style={{ fontSize: 12 }}>/mês</span></strong>
            </div>
            <p className="muted" style={{ marginBottom: 16 }}>{plan.description ?? "-"}</p>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>Usuários</span><strong>{plan.maxUsers}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>Profissionais</span><strong>{plan.maxProfessionals}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>Clientes</span><strong>{plan.maxCustomers}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>Agendamentos/mês</span><strong>{plan.maxAppointmentsPerMonth}</strong></div>
            </div>
            <div style={{ borderTop: "1px solid var(--border)", marginTop: 16, paddingTop: 12, display: "grid", gap: 4 }}>
              {boolFeatures.map(([key, label]) => (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  {plan[key] ? <Check size={14} color="var(--success)" /> : <X size={14} color="var(--muted)" />}
                  <span style={{ color: plan[key] ? "var(--text)" : "var(--muted)" }}>{label}</span>
                </div>
              ))}
            </div>
            <div style={{ borderTop: "1px solid var(--border)", marginTop: 12, paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="muted" style={{ fontSize: 12 }}>{plan._count?.subscriptions ?? 0} empresas vinculadas</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="icon-button secondary" title="Editar plano" onClick={() => openEdit(plan)} type="button">
                  <Edit2 size={14} />
                </button>
                <button className="icon-button secondary" title={plan.isActive ? "Desativar" : "Ativar"} onClick={() => toggleActive(plan)} type="button">
                  {plan.isActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                </button>
              </div>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
