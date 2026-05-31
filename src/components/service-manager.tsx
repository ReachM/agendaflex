"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban,
  CheckCircle,
  Clock,
  DollarSign,
  Edit2,
  Eye,
  EyeOff,
  FolderPlus,
  Plus,
  Save,
  Sparkles,
  X
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { apiFetch } from "@/lib/client-api";

type Category = {
  id: string;
  name: string;
  color: string | null;
  sortOrder: number;
  isActive: boolean;
  _count?: { services: number };
};

type Service = {
  id: string;
  name: string;
  description: string | null;
  basePrice: number | null;
  durationMinutes: number;
  sortOrder: number;
  isActive: boolean;
  isPublic: boolean;
  categoryId: string | null;
  checklistTemplateId: string | null;
  category: { id: string; name: string; color: string | null } | null;
  checklistTemplate: { id: string; name: string; status: string } | null;
  stats: { count: number; totalRevenue: number };
};

type Metrics = {
  totalServices: number;
  activeServices: number;
  inactiveServices: number;
  topService: { id: string; name: string; count: number } | null;
  avgTicket: number;
  totalAppointmentServices: number;
};

type Response = {
  services: Service[];
  categories: Category[];
  metrics: Metrics;
};

function formatMoney(value: number | null) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${m}`;
}

export function ServiceManager() {
  const [data, setData] = useState<Response | null>(null);
  const [error, setError] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Service form
  const [form, setForm] = useState({
    name: "", description: "", basePrice: "", durationMinutes: "60",
    categoryId: "", isPublic: true, isActive: true
  });

  // Category form
  const [catName, setCatName] = useState("");
  const [catColor, setCatColor] = useState("");

  // Edit
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [editForm, setEditForm] = useState({
    name: "", description: "", basePrice: "", durationMinutes: "60",
    categoryId: "", isPublic: true, isActive: true
  });

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (category !== "all") params.set("category", category);
      const result = await apiFetch<Response>(`/api/services?${params}`);
      setData(result);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }, [category]);

  useEffect(() => { void load(); }, [load]);

  async function submitService(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      await apiFetch("/api/services", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          basePrice: form.basePrice ? Number(form.basePrice) : undefined,
          durationMinutes: Number(form.durationMinutes),
          categoryId: form.categoryId || null,
          isPublic: form.isPublic,
          isActive: form.isActive
        })
      });
      setForm({ name: "", description: "", basePrice: "", durationMinutes: "60", categoryId: "", isPublic: true, isActive: true });
      setShowForm(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function submitCategory(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      await apiFetch("/api/service-categories", {
        method: "POST",
        body: JSON.stringify({ name: catName, color: catColor || null })
      });
      setCatName(""); setCatColor("");
      setShowCategoryForm(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function openEdit(s: Service) {
    setEditingService(s);
    setEditForm({
      name: s.name,
      description: s.description ?? "",
      basePrice: s.basePrice !== null ? String(s.basePrice) : "",
      durationMinutes: String(s.durationMinutes),
      categoryId: s.categoryId ?? "",
      isPublic: s.isPublic,
      isActive: s.isActive
    });
  }

  async function submitEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingService) return;
    setSaving(true); setError("");
    try {
      await apiFetch(`/api/services/${editingService.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editForm.name,
          description: editForm.description || undefined,
          basePrice: editForm.basePrice ? Number(editForm.basePrice) : undefined,
          durationMinutes: Number(editForm.durationMinutes),
          categoryId: editForm.categoryId || null,
          isPublic: editForm.isPublic,
          isActive: editForm.isActive
        })
      });
      setEditingService(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(s: Service) {
    try {
      await apiFetch(`/api/services/${s.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !s.isActive })
      });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function togglePublic(s: Service) {
    try {
      await apiFetch(`/api/services/${s.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isPublic: !s.isPublic })
      });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function removeCategory(id: string) {
    if (!confirm("Desativar esta categoria? Serviços vinculados ficarão sem categoria.")) return;
    try {
      await apiFetch(`/api/service-categories/${id}`, { method: "DELETE" });
      if (category === id) setCategory("all");
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const groupedByCategory = useMemo(() => {
    if (!data) return [];
    const groups = new Map<string, { name: string; services: Service[] }>();
    for (const s of data.services) {
      const key = s.categoryId ?? "__none";
      const name = s.category?.name ?? "Sem categoria";
      if (!groups.has(key)) groups.set(key, { name, services: [] });
      groups.get(key)!.services.push(s);
    }
    return Array.from(groups.entries()).map(([id, g]) => ({ id, ...g }));
  }, [data]);

  return (
    <>
      <PageHeader
        title="Serviços"
        subtitle={data ? `${data.metrics.activeServices} ativos · ${data.categories.length} categorias` : "Catálogo de serviços"}
        actions={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setShowCategoryForm(s => !s)}>
              <FolderPlus size={15} /> Nova categoria
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setShowForm(s => !s)}>
              <Plus size={15} /> Novo serviço
            </button>
          </>
        }
      />

      {error ? <div className="error-box">{error}</div> : null}

      {data ? (
        <>
          {/* Cards */}
          <div className="grid cols-3" style={{ marginBottom: 16 }}>
            <div className="stat-card stat-card--info">
              <div className="stat-card__header">
                <div>
                  <div className="stat-card__label">Serviços ativos</div>
                  <div className="stat-card__value">{data.metrics.activeServices}</div>
                </div>
                <div className="stat-card__icon"><CheckCircle size={18} /></div>
              </div>
              <div className="stat-card__footer">{data.metrics.inactiveServices} inativos</div>
            </div>
            <div className="stat-card stat-card--warning">
              <div className="stat-card__header">
                <div>
                  <div className="stat-card__label">Serviço mais procurado</div>
                  <div className="stat-card__value" style={{ fontSize: 18 }}>{data.metrics.topService?.name ?? "—"}</div>
                </div>
                <div className="stat-card__icon"><Sparkles size={18} /></div>
              </div>
              <div className="stat-card__footer">{data.metrics.topService?.count ?? 0}x agendado</div>
            </div>
            <div className="stat-card stat-card--success">
              <div className="stat-card__header">
                <div>
                  <div className="stat-card__label">Ticket médio</div>
                  <div className="stat-card__value" style={{ fontSize: 22 }}>{formatMoney(data.metrics.avgTicket)}</div>
                </div>
                <div className="stat-card__icon"><DollarSign size={18} /></div>
              </div>
              <div className="stat-card__footer">{data.metrics.totalAppointmentServices} agendamentos</div>
            </div>
          </div>

          {/* Category tabs */}
          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel__head" style={{ flexDirection: "column", alignItems: "stretch", gap: 12 }}>
              <div className="tabs" style={{ flexWrap: "wrap" }}>
                <button type="button" className={`tab ${category === "all" ? "active" : ""}`} onClick={() => setCategory("all")}>
                  Todos
                </button>
                {data.categories.map(c => (
                  <button key={c.id} type="button" className={`tab ${category === c.id ? "active" : ""}`} onClick={() => setCategory(c.id)}>
                    {c.color ? <span style={{ width: 8, height: 8, borderRadius: 999, background: c.color, marginRight: 6, display: "inline-block" }} /> : null}
                    {c.name} {c._count ? <span style={{ marginLeft: 4, color: "var(--muted)" }}>({c._count.services})</span> : null}
                  </button>
                ))}
                <button type="button" className={`tab ${category === "uncategorized" ? "active" : ""}`} onClick={() => setCategory("uncategorized")}>
                  Sem categoria
                </button>
              </div>
            </div>
          </div>

          {/* Forms */}
          {showCategoryForm ? (
            <section className="panel" style={{ marginBottom: 16 }}>
              <div className="panel__head">
                <div className="panel__title">Nova categoria</div>
              </div>
              <div className="panel__body">
                <form onSubmit={submitCategory} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10 }}>
                  <input className="input" required placeholder="Ex.: Cabelo, Unhas, Estética" value={catName} onChange={e => setCatName(e.target.value)} />
                  <input className="input" type="color" value={catColor || "#0d9488"} onChange={e => setCatColor(e.target.value)} style={{ width: 60 }} />
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    <FolderPlus size={14} /> Adicionar
                  </button>
                </form>
                {data.categories.length > 0 ? (
                  <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {data.categories.map(c => (
                      <span key={c.id} className="pill pill--muted" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {c.color ? <span style={{ width: 8, height: 8, borderRadius: 999, background: c.color }} /> : null}
                        {c.name} ({c._count?.services ?? 0})
                        <button type="button" onClick={() => removeCategory(c.id)} style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--danger)", padding: 0, marginLeft: 4 }}>
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {showForm ? (
            <section className="panel" style={{ marginBottom: 16 }}>
              <div className="panel__head">
                <div className="panel__title">Novo serviço</div>
              </div>
              <div className="panel__body">
                <form onSubmit={submitService} className="form-grid">
                  <div className="field full">
                    <label>Nome *</label>
                    <input className="input" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Categoria</label>
                    <select className="select" value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })}>
                      <option value="">— Sem categoria —</option>
                      {data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>Preço base (R$)</label>
                    <input className="input" type="number" step="0.01" value={form.basePrice} onChange={e => setForm({ ...form, basePrice: e.target.value })} placeholder="0,00" />
                  </div>
                  <div className="field">
                    <label>Duração (minutos) *</label>
                    <input className="input" type="number" required min="1" value={form.durationMinutes} onChange={e => setForm({ ...form, durationMinutes: e.target.value })} />
                  </div>
                  <div className="field">
                    <label className="checkbox-line">
                      <input type="checkbox" checked={form.isPublic} onChange={e => setForm({ ...form, isPublic: e.target.checked })} />
                      <span>Visível no link público</span>
                    </label>
                  </div>
                  <div className="field full">
                    <label>Descrição</label>
                    <textarea className="textarea" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                  </div>
                  <div className="field full" style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                    <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                      <Save size={14} /> {saving ? "Salvando..." : "Salvar serviço"}
                    </button>
                  </div>
                </form>
              </div>
            </section>
          ) : null}

          {/* Services list grouped by category */}
          {groupedByCategory.length === 0 ? (
            <section className="panel">
              <div className="panel__body">
                <div className="empty-state">
                  <div className="empty-state__icon"><Sparkles size={24} /></div>
                  <h3>Nenhum serviço cadastrado</h3>
                  <p>Crie categorias e serviços para começar.</p>
                </div>
              </div>
            </section>
          ) : (
            groupedByCategory.map(group => (
              <section key={group.id} className="panel" style={{ marginBottom: 16 }}>
                <div className="panel__head">
                  <div>
                    <div className="panel__title">{group.name}</div>
                    <div className="panel__sub">{group.services.length} serviços</div>
                  </div>
                </div>
                <div className="panel__body panel__body--flush">
                  <div className="table-wrap" style={{ borderRadius: 0, border: 0, boxShadow: "none" }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Serviço</th>
                          <th className="col-hide-mobile">Duração</th>
                          <th style={{ textAlign: "right" }}>Preço</th>
                          <th className="col-hide-mobile">Agendamentos</th>
                          <th>Visibilidade</th>
                          <th>Status</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.services.map(s => (
                          <tr key={s.id} onClick={() => openEdit(s)} style={{ cursor: "pointer" }}>
                            <td>
                              <strong style={{ fontSize: 13 }}>{s.name}</strong>
                              {s.description ? <div style={{ fontSize: 11, color: "var(--muted)" }}>{s.description}</div> : null}
                              {s.checklistTemplate ? <div style={{ fontSize: 10, color: "var(--primary)", marginTop: 2 }}>✓ {s.checklistTemplate.name}</div> : null}
                            </td>
                            <td className="col-hide-mobile">
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--muted)" }}>
                                <Clock size={11} /> {formatDuration(s.durationMinutes)}
                              </span>
                            </td>
                            <td style={{ textAlign: "right", fontWeight: 600 }}>{formatMoney(s.basePrice)}</td>
                            <td className="col-hide-mobile">{s.stats.count}x</td>
                            <td onClick={e => e.stopPropagation()}>
                              <button type="button" className="btn btn-sm btn-ghost" onClick={() => togglePublic(s)} title={s.isPublic ? "Ocultar do link público" : "Mostrar no link público"}>
                                {s.isPublic ? <><Eye size={12} /> Online</> : <><EyeOff size={12} /> Oculto</>}
                              </button>
                            </td>
                            <td>
                              <span className={`pill ${s.isActive ? "pill--success" : "pill--muted"}`}>
                                {s.isActive ? "Ativo" : "Inativo"}
                              </span>
                            </td>
                            <td style={{ textAlign: "right" }} onClick={e => e.stopPropagation()}>
                              <button type="button" className="btn btn-sm btn-ghost" onClick={() => openEdit(s)} title="Editar">
                                <Edit2 size={13} />
                              </button>
                              {s.isActive ? (
                                <button type="button" className="btn btn-sm btn-danger-ghost" onClick={() => toggleActive(s)} title="Desativar">
                                  <Ban size={13} />
                                </button>
                              ) : (
                                <button type="button" className="btn btn-sm btn-ghost" onClick={() => toggleActive(s)} title="Reativar">
                                  <CheckCircle size={13} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            ))
          )}
        </>
      ) : (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <div className="loading-spinner" />
        </div>
      )}

      {/* Edit modal */}
      {editingService ? (
        <div className="modal-overlay" onClick={() => setEditingService(null)} role="dialog" aria-modal="true">
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="preview-modal__header">
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Editar serviço</h2>
              <button type="button" className="icon-button secondary" onClick={() => setEditingService(null)} aria-label="Fechar">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={submitEdit} className="form-grid" style={{ marginTop: 16 }}>
              <div className="field full">
                <label>Nome *</label>
                <input className="input" required value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div className="field">
                <label>Categoria</label>
                <select className="select" value={editForm.categoryId} onChange={e => setEditForm({ ...editForm, categoryId: e.target.value })}>
                  <option value="">— Sem categoria —</option>
                  {data?.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Preço base (R$)</label>
                <input className="input" type="number" step="0.01" value={editForm.basePrice} onChange={e => setEditForm({ ...editForm, basePrice: e.target.value })} />
              </div>
              <div className="field">
                <label>Duração (minutos) *</label>
                <input className="input" type="number" required min="1" value={editForm.durationMinutes} onChange={e => setEditForm({ ...editForm, durationMinutes: e.target.value })} />
              </div>
              <div className="field">
                <label className="checkbox-line">
                  <input type="checkbox" checked={editForm.isPublic} onChange={e => setEditForm({ ...editForm, isPublic: e.target.checked })} />
                  <span>Visível no link público</span>
                </label>
              </div>
              <div className="field">
                <label className="checkbox-line">
                  <input type="checkbox" checked={editForm.isActive} onChange={e => setEditForm({ ...editForm, isActive: e.target.checked })} />
                  <span>Ativo</span>
                </label>
              </div>
              <div className="field full">
                <label>Descrição</label>
                <textarea className="textarea" rows={2} value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
              </div>
              <div className="field full" style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setEditingService(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  <Save size={14} /> {saving ? "Salvando..." : "Salvar alterações"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
