"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlignJustify,
  Ban,
  Briefcase,
  Circle,
  Clock,
  DollarSign,
  FolderPlus,
  MoreVertical,
  Plus,
  Save,
  Search,
  Sliders,
  Sparkles,
  Tag,
  TrendingUp,
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

type ProfessionalLink = {
  professional: { id: string; name: string };
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
  professionals?: ProfessionalLink[];
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

type SortKey = "popular" | "price_desc" | "price_asc" | "name";

const AVATAR_COLORS = [
  "#0d9488", "#2563eb", "#d97706", "#9333ea",
  "#dc2626", "#16a34a", "#0891b2", "#c2410c"
];

function formatMoney(value: number | null) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatPriceInt(value: number | null) {
  if (value === null || value === undefined) return "—";
  const rounded = Math.round(value);
  if (Math.abs(value - rounded) < 0.005) {
    return new Intl.NumberFormat("pt-BR").format(rounded);
  }
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function getAvatarColor(name: string): string {
  let hash = 0;
  for (const c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";
}

function hexToRgba(hex: string | null | undefined, alpha = 0.16): string {
  if (!hex) return "rgba(100, 116, 139, 0.16)";
  const m = hex.replace("#", "").match(/^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return hex;
  const [, r, g, b] = m;
  return `rgba(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}, ${alpha})`;
}

function getServiceGradient(name: string, fallbackColor?: string | null): string {
  const lower = name.toLowerCase();
  if (lower.includes("color")) return "linear-gradient(135deg, #d97706, #b45309)";
  if (lower.includes("corte")) return "linear-gradient(135deg, #0d9488, #0f766e)";
  if (lower.includes("manicure")) return "linear-gradient(135deg, #db2777, #9d174d)";
  if (lower.includes("pedicure")) return "linear-gradient(135deg, #db2777, #be185d)";
  if (lower.includes("progressiva") || lower.includes("alisamento")) return "linear-gradient(135deg, #9333ea, #7e22ce)";
  if (lower.includes("hidrat")) return "linear-gradient(135deg, #2563eb, #1d4ed8)";
  if (lower.includes("mecha") || lower.includes("luzes")) return "linear-gradient(135deg, #fbbf24, #d97706)";
  if (lower.includes("sobrancelha")) return "linear-gradient(135deg, #16a34a, #15803d)";
  if (lower.includes("escova")) return "linear-gradient(135deg, #0891b2, #0e7490)";
  if (lower.includes("barba")) return "linear-gradient(135deg, #475569, #1e293b)";
  if (lower.includes("massa")) return "linear-gradient(135deg, #14b8a6, #0d9488)";
  if (lower.includes("limpeza")) return "linear-gradient(135deg, #0ea5e9, #0284c7)";
  if (fallbackColor) return `linear-gradient(135deg, ${fallbackColor}, ${fallbackColor})`;
  return "linear-gradient(135deg, var(--primary), var(--primary-hover))";
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${m}`;
}

type GroupedCategory = {
  id: string;
  name: string;
  color: string;
  colorLight: string;
  services: Service[];
};

export function ServiceManager() {
  const [data, setData] = useState<Response | null>(null);
  const [error, setError] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("popular");
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
  const [catColor, setCatColor] = useState("#0d9488");

  // Edit
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [editForm, setEditForm] = useState({
    name: "", description: "", basePrice: "", durationMinutes: "60",
    categoryId: "", isPublic: true, isActive: true
  });

  const load = useCallback(async () => {
    try {
      const result = await apiFetch<Response>("/api/services");
      setData(result);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

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
      setCatName(""); setCatColor("#0d9488");
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

  function openCreateInCategory(categoryId: string) {
    setForm({
      name: "", description: "", basePrice: "", durationMinutes: "60",
      categoryId: categoryId === "none" ? "" : categoryId,
      isPublic: true, isActive: true
    });
    setShowForm(true);
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

  // ── Derivados ─────────────────────────────────────
  const services = useMemo(() => data?.services ?? [], [data]);
  const categories = useMemo(() => data?.categories ?? [], [data]);
  const metrics = data?.metrics;

  // Contagem de serviços por categoria (ativos apenas)
  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const cat of categories) map.set(cat.id, 0);
    map.set("__none", 0);
    for (const s of services) {
      if (!s.isActive) continue;
      const key = s.categoryId ?? "__none";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [services, categories]);

  const groupedServices = useMemo<GroupedCategory[]>(() => {
    let filtered: Service[];
    if (activeCategory === "inactive") {
      filtered = services.filter(s => !s.isActive);
    } else if (activeCategory === "all") {
      filtered = services.filter(s => s.isActive);
    } else if (activeCategory === "none") {
      filtered = services.filter(s => s.isActive && !s.categoryId);
    } else {
      filtered = services.filter(s => s.isActive && s.categoryId === activeCategory);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(s => s.name.toLowerCase().includes(q));
    }

    filtered = [...filtered].sort((a, b) => {
      if (sortBy === "popular") return b.stats.count - a.stats.count;
      if (sortBy === "price_desc") return (b.basePrice ?? 0) - (a.basePrice ?? 0);
      if (sortBy === "price_asc") return (a.basePrice ?? 0) - (b.basePrice ?? 0);
      return a.name.localeCompare(b.name, "pt-BR");
    });

    if (activeCategory === "all") {
      const groups = new Map<string, GroupedCategory>();
      for (const cat of categories) {
        groups.set(cat.id, {
          id: cat.id,
          name: cat.name,
          color: cat.color ?? "var(--primary)",
          colorLight: hexToRgba(cat.color),
          services: []
        });
      }
      groups.set("none", {
        id: "none",
        name: "Sem categoria",
        color: "var(--muted)",
        colorLight: "var(--surface-muted)",
        services: []
      });
      for (const svc of filtered) {
        const key = svc.categoryId ?? "none";
        groups.get(key)?.services.push(svc);
      }
      return [...groups.values()].filter(g => g.services.length > 0);
    }

    if (activeCategory === "inactive") {
      return [{
        id: "inactive",
        name: "Serviços inativos",
        color: "var(--muted)",
        colorLight: "var(--surface-muted)",
        services: filtered
      }];
    }

    if (activeCategory === "none") {
      return [{
        id: "none",
        name: "Sem categoria",
        color: "var(--muted)",
        colorLight: "var(--surface-muted)",
        services: filtered
      }];
    }

    const cat = categories.find(c => c.id === activeCategory);
    if (!cat) return [];
    return [{
      id: cat.id,
      name: cat.name,
      color: cat.color ?? "var(--primary)",
      colorLight: hexToRgba(cat.color),
      services: filtered
    }];
  }, [services, categories, activeCategory, search, sortBy]);

  const sectionTitle = useMemo(() => {
    if (activeCategory === "all") return "Todos os serviços";
    if (activeCategory === "inactive") return "Serviços inativos";
    if (activeCategory === "none") return "Sem categoria";
    return categories.find(c => c.id === activeCategory)?.name ?? "Serviços";
  }, [activeCategory, categories]);

  const subtitle = metrics
    ? `${metrics.activeServices} serviços ativos em ${categories.length} categorias · ticket médio ${formatMoney(metrics.avgTicket)}`
    : "Catálogo de serviços";

  return (
    <>
      <PageHeader
        title="Serviços"
        subtitle={subtitle}
        actions={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => alert("Reordenação em breve.")}>
              <AlignJustify size={15} />
              Reordenar
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowCategoryForm(s => !s)}>
              <FolderPlus size={15} />
              Nova categoria
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setShowForm(s => !s)}>
              <Plus size={15} />
              Novo serviço
            </button>
          </>
        }
      />

      {error ? <div className="error-box">{error}</div> : null}

      {!data ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <div className="loading-spinner" />
        </div>
      ) : (
        <>
          {/* Top Stats */}
          {metrics ? (
            <section className="top-stats">
              <div className="ts-card">
                <div className="ts-card__ico"><Briefcase size={18} /></div>
                <div>
                  <div className="ts-card__v">{metrics.activeServices}</div>
                  <div className="ts-card__l">Serviços ativos</div>
                </div>
              </div>
              <div className="ts-card ts-card--ok">
                <div className="ts-card__ico"><Activity size={18} /></div>
                <div>
                  <div className="ts-card__v">{metrics.topService?.name ?? "—"}</div>
                  <div className="ts-card__l">
                    Mais procurado · {metrics.topService?.count ?? 0}×
                  </div>
                </div>
              </div>
              <div className="ts-card ts-card--accent">
                <div className="ts-card__ico"><DollarSign size={18} /></div>
                <div>
                  <div className="ts-card__v">{formatMoney(metrics.avgTicket)}</div>
                  <div className="ts-card__l">Ticket médio dos serviços</div>
                </div>
              </div>
            </section>
          ) : null}

          {/* Formulário inline de nova categoria */}
          {showCategoryForm ? (
            <section className="panel" style={{ marginBottom: 16 }}>
              <div className="panel__head">
                <div className="panel__title">Nova categoria</div>
              </div>
              <div className="panel__body">
                <form onSubmit={submitCategory} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10 }}>
                  <input className="input" required placeholder="Ex.: Cabelo, Unhas, Estética" value={catName} onChange={e => setCatName(e.target.value)} />
                  <input className="input" type="color" value={catColor} onChange={e => setCatColor(e.target.value)} style={{ width: 60 }} />
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    <FolderPlus size={14} /> Adicionar
                  </button>
                </form>
              </div>
            </section>
          ) : null}

          {/* Formulário inline de novo serviço */}
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
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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

          {/* Grid principal: sidebar + main */}
          <div className="svc-grid">
            {/* Sidebar de categorias */}
            <aside className="cat-list" role="navigation" aria-label="Categorias">
              <h4>Categorias</h4>
              <button
                type="button"
                className={`cat-list__item${activeCategory === "all" ? " is-active" : ""}`}
                onClick={() => setActiveCategory("all")}
              >
                <span className="ico"><Circle size={14} /></span>
                Todos
                <span className="count">{metrics?.activeServices ?? 0}</span>
              </button>

              {categories.map(cat => {
                const isActive = activeCategory === cat.id;
                const color = cat.color ?? "#64748b";
                return (
                  <button
                    key={cat.id}
                    type="button"
                    className={`cat-list__item${isActive ? " is-active" : ""}`}
                    onClick={() => setActiveCategory(cat.id)}
                  >
                    <span
                      className="ico"
                      style={{
                        background: isActive ? color : hexToRgba(cat.color),
                        color: isActive ? "#fff" : color
                      }}
                    >
                      <Tag size={14} />
                    </span>
                    {cat.name}
                    <span className="count">{categoryCounts.get(cat.id) ?? 0}</span>
                  </button>
                );
              })}

              {(categoryCounts.get("__none") ?? 0) > 0 ? (
                <button
                  type="button"
                  className={`cat-list__item${activeCategory === "none" ? " is-active" : ""}`}
                  onClick={() => setActiveCategory("none")}
                >
                  <span className="ico"><Circle size={14} /></span>
                  Sem categoria
                  <span className="count">{categoryCounts.get("__none") ?? 0}</span>
                </button>
              ) : null}

              <div className="divider" />

              <button
                type="button"
                className={`cat-list__item${activeCategory === "inactive" ? " is-active" : ""}`}
                onClick={() => setActiveCategory("inactive")}
              >
                <span className="ico"><Ban size={14} /></span>
                Inativos
                <span className="count">{metrics?.inactiveServices ?? 0}</span>
              </button>

              <button type="button" className="cat-list__add" onClick={() => setShowCategoryForm(true)}>
                <Plus size={14} />
                Nova categoria
              </button>
            </aside>

            {/* Área principal */}
            <div>
              <div className="section-bar">
                <h3>
                  <Sliders size={18} />
                  {sectionTitle}
                </h3>
                <div className="ctrls">
                  <div className="svc-search">
                    <Search size={15} />
                    <input
                      type="search"
                      placeholder="Buscar serviço…"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                  </div>
                  <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)}>
                    <option value="popular">Mais procurados</option>
                    <option value="price_desc">Maior preço</option>
                    <option value="price_asc">Menor preço</option>
                    <option value="name">Nome A-Z</option>
                  </select>
                </div>
              </div>

              {groupedServices.length === 0 ? (
                <div className="svc-empty">
                  <Sparkles size={32} />
                  <h3>Nenhum serviço encontrado</h3>
                  <p>Ajuste a busca ou crie um novo serviço.</p>
                </div>
              ) : (
                groupedServices.map(group => (
                  <div key={group.id}>
                    {activeCategory === "all" ? (
                      <div className="group-header">
                        <span className="swatch" style={{ background: group.color }} />
                        {group.name}
                        <span className="count">· {group.services.length} {group.services.length === 1 ? "serviço" : "serviços"}</span>
                      </div>
                    ) : null}

                    <div className="svc-cards">
                      {group.services.map(svc => (
                        <ServiceCard
                          key={svc.id}
                          service={svc}
                          onEdit={() => openEdit(svc)}
                          onToggleActive={() => toggleActive(svc)}
                        />
                      ))}

                      {activeCategory !== "inactive" ? (
                        <button
                          type="button"
                          className="svc-add"
                          onClick={() => openCreateInCategory(group.id)}
                        >
                          <Plus size={30} strokeWidth={1.8} />
                          <div className="t">Novo serviço de {group.name.toLowerCase()}</div>
                          <div className="s">Nome, duração, preço e profissionais</div>
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
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
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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

function ServiceCard({
  service,
  onEdit,
  onToggleActive
}: {
  service: Service;
  onEdit: () => void;
  onToggleActive: () => void;
}) {
  const gradient = getServiceGradient(service.name, service.category?.color);
  const professionals = service.professionals ?? [];
  const visible = professionals.slice(0, 3);
  const extra = professionals.length - visible.length;

  return (
    <article
      className={`svc${!service.isActive ? " is-inactive" : ""}`}
      onClick={onEdit}
    >
      <div className="svc__head">
        <div className="svc__color" style={{ background: gradient }}>
          <Tag size={16} />
        </div>
        <div className="svc__name">{service.name}</div>
        <button
          type="button"
          className="svc__menu"
          onClick={e => { e.stopPropagation(); onToggleActive(); }}
          title={service.isActive ? "Desativar" : "Reativar"}
          aria-label="Mais opções"
        >
          <MoreVertical size={14} />
        </button>
      </div>

      <div className="svc__price">
        <span className="unit">R$</span>
        {formatPriceInt(service.basePrice)}
      </div>

      <div className="svc__meta">
        <span>
          <Clock size={12} />
          {formatDuration(service.durationMinutes)}
        </span>
        <span>
          <TrendingUp size={12} />
          {service.stats.count}×
        </span>
        {!service.isActive ? <span className="svc__inactive">Inativo</span> : null}
      </div>

      <div className="svc__foot">
        {professionals.length > 0 ? (
          <div className="svc__pros">
            {visible.map(p => (
              <span
                key={p.professional.id}
                className="av"
                style={{ background: getAvatarColor(p.professional.name) }}
                title={p.professional.name}
              >
                {getInitials(p.professional.name)}
              </span>
            ))}
            {extra > 0 ? <span className="more">+{extra}</span> : null}
          </div>
        ) : (
          <span className="svc__pros--empty">Sem profissionais</span>
        )}

        {service.isPublic ? (
          <span className="svc__online">
            <span className="dot" />
            Online
          </span>
        ) : (
          <span className="svc__online svc__online--off">
            <span className="dot" />
            Oculto
          </span>
        )}
      </div>
    </article>
  );
}
