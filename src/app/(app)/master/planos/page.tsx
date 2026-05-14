"use client";
import { Check, CreditCard, Plus, Save, X } from "lucide-react";
import { useEffect, useState, FormEvent } from "react";
import { PageHeader } from "@/components/page-header";
import { apiFetch } from "@/lib/client-api";

type AnyRecord = Record<string, any>;

function formatMoney(v?: any) {
  if (v == null) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));
}

export default function MasterPlanosPage() {
  const [plans, setPlans] = useState<AnyRecord[]>([]);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "", slug: "", description: "", price: "0", maxUsers: "3", maxProfessionals: "5",
    maxCustomers: "100", maxAppointmentsPerMonth: "200",
    allowClientSelfScheduling: false, allowAdvancedReports: false, allowFinancialControl: false,
    allowInvoiceRequest: false, allowCustomerChecklist: false
  });

  async function load() {
    try { const data = await apiFetch<{ plans: AnyRecord[] }>("/api/plans"); setPlans(data.plans); }
    catch (err) { setError((err as Error).message); }
  }
  useEffect(() => { load(); }, []);

  async function submit(e: FormEvent) {
    e.preventDefault(); setError("");
    try {
      await apiFetch("/api/plans", {
        method: "POST",
        body: JSON.stringify({
          ...form, price: Number(form.price), maxUsers: Number(form.maxUsers),
          maxProfessionals: Number(form.maxProfessionals), maxCustomers: Number(form.maxCustomers),
          maxAppointmentsPerMonth: Number(form.maxAppointmentsPerMonth)
        })
      });
      setShowForm(false);
      await load();
    } catch (err) { setError((err as Error).message); }
  }

  const boolFeatures = [
    ["allowClientSelfScheduling", "Agendamento público"],
    ["allowAdvancedReports", "Relatórios avançados"],
    ["allowFinancialControl", "Controle financeiro"],
    ["allowInvoiceRequest", "Nota fiscal"],
    ["allowCustomerChecklist", "Checklist/Via cliente"]
  ] as const;

  return (
    <>
      <PageHeader title="Planos" subtitle="Planos SaaS da plataforma" actions={<button className="button" onClick={() => setShowForm(true)} type="button"><Plus size={16} /> Novo Plano</button>} />
      {error && <div className="error-box">{error}</div>}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="toolbar" style={{ marginBottom: 16 }}><h2 className="section-title">Novo Plano</h2><button className="icon-button secondary" onClick={() => setShowForm(false)} type="button"><X size={16} /></button></div>
            <form className="form-grid" onSubmit={submit}>
              <div className="field"><label>Nome</label><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div className="field"><label>Slug</label><input required value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="ex: enterprise" /></div>
              <div className="field"><label>Preço (R$)</label><input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></div>
              <div className="field"><label>Máx. Usuários</label><input type="number" value={form.maxUsers} onChange={e => setForm({ ...form, maxUsers: e.target.value })} /></div>
              <div className="field"><label>Máx. Profissionais</label><input type="number" value={form.maxProfessionals} onChange={e => setForm({ ...form, maxProfessionals: e.target.value })} /></div>
              <div className="field"><label>Máx. Agendamentos/Mês</label><input type="number" value={form.maxAppointmentsPerMonth} onChange={e => setForm({ ...form, maxAppointmentsPerMonth: e.target.value })} /></div>
              <div className="field full"><label>Descrição</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              {boolFeatures.map(([key, label]) => (
                <div key={key} className="checkbox-line"><input type="checkbox" checked={(form as any)[key]} onChange={e => setForm({ ...form, [key]: e.target.checked })} /><label>{label}</label></div>
              ))}
              <div className="field full"><button className="button" type="submit"><Save size={16} /> Criar Plano</button></div>
            </form>
          </div>
        </div>
      )}

      <div className="grid cols-3">
        {plans.map(plan => (
          <section key={plan.id} className="panel" style={{ position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h2 className="section-title">{plan.name}</h2>
                <span className="muted">{plan.slug}</span>
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
            <div className="muted" style={{ marginTop: 12, fontSize: 12 }}>{plan._count?.subscriptions ?? 0} empresas</div>
          </section>
        ))}
      </div>
    </>
  );
}
