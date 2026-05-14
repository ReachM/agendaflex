"use client";
import { CheckSquare, ClipboardList, Plus, Printer, Save, Square, X } from "lucide-react";
import { useEffect, useState, FormEvent } from "react";
import { PageHeader } from "@/components/page-header";
import { apiFetch } from "@/lib/client-api";

type AnyRecord = Record<string, any>;

export default function ChecklistsPage() {
  const [checklists, setChecklists] = useState<AnyRecord[]>([]);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ appointmentId: "", title: "Checklist do atendimento", notes: "", items: [{ description: "" }] });
  const [appointments, setAppointments] = useState<AnyRecord[]>([]);

  async function load() {
    try {
      const [checklistData, apptData] = await Promise.all([
        apiFetch<{ checklists: AnyRecord[] }>("/api/checklists"),
        apiFetch<{ appointments: AnyRecord[] }>("/api/appointments")
      ]);
      setChecklists(checklistData.checklists);
      setAppointments(apptData.appointments);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => { load(); }, []);

  function addItem() { setForm({ ...form, items: [...form.items, { description: "" }] }); }
  function removeItem(idx: number) {
    if (form.items.length <= 1) return;
    setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });
  }
  function updateItem(idx: number, value: string) {
    const items = [...form.items];
    items[idx] = { description: value };
    setForm({ ...form, items });
  }

  async function toggleItem(checklistId: string, itemId: string, isChecked: boolean) {
    try {
      await apiFetch(`/api/checklists/${checklistId}/items/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify({ isChecked: !isChecked })
      });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await apiFetch("/api/checklists", {
        method: "POST",
        body: JSON.stringify({ ...form, items: form.items.filter(i => i.description.trim()) })
      });
      setShowForm(false);
      setForm({ appointmentId: "", title: "Checklist do atendimento", notes: "", items: [{ description: "" }] });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (error && checklists.length === 0) {
    return (
      <>
        <PageHeader title="Checklists" subtitle="Checklist e via do cliente" />
        <div className="upgrade-banner">
          <div className="upgrade-banner__icon"><CheckSquare size={24} /></div>
          <div className="upgrade-banner__text"><strong>Funcionalidade Premium</strong><span>{error}</span></div>
        </div>
      </>
    );
  }

  function getProgress(cl: AnyRecord) {
    const items = cl.items ?? [];
    if (items.length === 0) return 0;
    return Math.round((items.filter((i: any) => i.isChecked).length / items.length) * 100);
  }

  return (
    <>
      <PageHeader title="Checklists" subtitle="Checklist de atendimento e via do cliente" actions={<button className="button" type="button" onClick={() => setShowForm(true)}><Plus size={16} /> Novo Checklist</button>} />
      {error && <div className="error-box">{error}</div>}

      {/* ─── Create Modal ─────────────────────────────── */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="toolbar" style={{ marginBottom: 16 }}>
              <h2 className="section-title">Novo Checklist</h2>
              <button className="icon-button secondary" onClick={() => setShowForm(false)} type="button"><X size={16} /></button>
            </div>
            <form className="form-grid" onSubmit={submit}>
              <div className="field full">
                <label>Agendamento</label>
                <select required value={form.appointmentId} onChange={e => setForm({ ...form, appointmentId: e.target.value })}>
                  <option value="">Selecionar agendamento</option>
                  {appointments.map(a => (
                    <option key={a.id} value={a.id}>{a.customer?.name} — {new Date(a.startAt).toLocaleDateString("pt-BR")}</option>
                  ))}
                </select>
              </div>
              <div className="field full"><label>Título</label><input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
              <div className="field full">
                <label>Itens do checklist</label>
                {form.items.map((item, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <input value={item.description} onChange={e => updateItem(idx, e.target.value)} placeholder={`Item ${idx + 1}`} style={{ flex: 1 }} />
                    {form.items.length > 1 && (
                      <button type="button" className="icon-button secondary" onClick={() => removeItem(idx)} title="Remover"><X size={14} /></button>
                    )}
                  </div>
                ))}
                <button type="button" className="button secondary" onClick={addItem} style={{ marginTop: 4 }}><Plus size={14} /> Adicionar item</button>
              </div>
              <div className="field full"><label>Observações</label><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              <div className="field full"><button className="button" type="submit"><Save size={16} /> Criar Checklist</button></div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Checklist Cards ──────────────────────────── */}
      {checklists.length === 0 ? (
        <div className="panel">
          <div className="empty-state">
            <div className="empty-state__icon"><ClipboardList size={28} /></div>
            <h3>Nenhum checklist criado</h3>
            <p>Crie checklists para documentar atendimentos e gerar vias do cliente.</p>
          </div>
        </div>
      ) : (
        <div className="grid cols-2">
          {checklists.map(cl => {
            const progress = getProgress(cl);
            const checkedCount = (cl.items ?? []).filter((i: any) => i.isChecked).length;
            const totalCount = (cl.items ?? []).length;

            return (
              <section key={cl.id} className="panel">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <h3 className="section-title" style={{ margin: 0 }}>{cl.title}</h3>
                    <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>{cl.appointment?.customer?.name} — {new Date(cl.appointment?.startAt).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <span className={`badge ${progress === 100 ? "success" : "warning"}`}>{checkedCount}/{totalCount}</span>
                </div>

                {/* Progress bar */}
                <div className="progress-bar" style={{ marginBottom: 12 }}>
                  <div className={`progress-bar__fill ${progress === 100 ? "" : "progress-bar__fill--warning"}`} style={{ width: `${progress}%` }} />
                </div>

                {/* Items */}
                <div style={{ display: "grid", gap: 8 }}>
                  {(cl.items ?? []).map((item: any) => (
                    <div
                      key={item.id}
                      className={`checklist-item ${item.isChecked ? "checked" : ""}`}
                      onClick={() => toggleItem(cl.id, item.id, item.isChecked)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="checklist-item__check">
                        {item.isChecked ? <CheckSquare size={14} /> : <Square size={14} />}
                      </div>
                      <span className="checklist-item__text">{item.description}</span>
                    </div>
                  ))}
                </div>

                {cl.notes && <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>{cl.notes}</p>}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
