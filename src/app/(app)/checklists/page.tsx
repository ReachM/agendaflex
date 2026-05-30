"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Camera,
  CheckSquare,
  Copy,
  FileText,
  ListChecks,
  Pause,
  Play,
  Plus,
  Save,
  StickyNote,
  Trash2,
  X
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { apiFetch } from "@/lib/client-api";

type ItemType = "CHECKBOX" | "NOTE" | "PHOTO";
type TemplateStatus = "DRAFT" | "ACTIVE" | "PAUSED";

type TemplateItem = {
  id?: string;
  description: string;
  itemType: ItemType;
  isRequired: boolean;
  helpText: string | null;
  sortOrder: number;
};

type TemplateSection = {
  id?: string;
  name: string;
  sortOrder: number;
  items: TemplateItem[];
};

type Template = {
  id: string;
  name: string;
  description: string | null;
  status: TemplateStatus;
  estimatedMinutes: number | null;
  sortOrder: number;
  sections: TemplateSection[];
  services: { id: string; name: string }[];
  _count?: { instances: number };
  createdAt: string;
};

type ListResponse = {
  templates: Template[];
  stats: { activeCount: number; pausedCount: number; draftCount: number; totalInstances: number };
};

const STATUS_LABELS: Record<TemplateStatus, string> = {
  DRAFT: "Rascunho",
  ACTIVE: "Ativo",
  PAUSED: "Pausado"
};

const STATUS_CLASS: Record<TemplateStatus, string> = {
  DRAFT: "pill--muted",
  ACTIVE: "pill--success",
  PAUSED: "pill--warn"
};

const ITEM_ICON: Record<ItemType, React.ReactNode> = {
  CHECKBOX: <CheckSquare size={14} />,
  NOTE: <StickyNote size={14} />,
  PHOTO: <Camera size={14} />
};

const ITEM_LABEL: Record<ItemType, string> = {
  CHECKBOX: "Checkbox",
  NOTE: "Nota",
  PHOTO: "Foto"
};

export default function ChecklistsPage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Template | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await apiFetch<ListResponse>("/api/checklists/templates");
      setData(result);
      setError("");
      if (!selectedId && result.templates.length > 0) {
        setSelectedId(result.templates[0].id);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }, [selectedId]);

  useEffect(() => { void load(); }, [load]);

  // Sync draft with selected template
  useEffect(() => {
    if (!data || !selectedId) {
      setDraft(null);
      return;
    }
    const tpl = data.templates.find(t => t.id === selectedId);
    if (tpl) {
      setDraft(JSON.parse(JSON.stringify(tpl)) as Template);
      setDirty(false);
    }
  }, [data, selectedId]);

  async function createTemplate() {
    setCreating(true);
    setError("");
    try {
      const result = await apiFetch<{ template: Template }>("/api/checklists/templates", {
        method: "POST",
        body: JSON.stringify({
          name: "Novo template",
          status: "DRAFT",
          sections: [{ name: "Seção 1", items: [{ description: "Item 1", itemType: "CHECKBOX", isRequired: false }] }]
        })
      });
      await load();
      setSelectedId(result.template.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function duplicateTemplate() {
    if (!draft) return;
    try {
      const result = await apiFetch<{ template: Template }>(`/api/checklists/templates/${draft.id}/duplicate`, { method: "POST" });
      await load();
      setSelectedId(result.template.id);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function toggleStatus(next: TemplateStatus) {
    if (!draft) return;
    try {
      await apiFetch(`/api/checklists/templates/${draft.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: next })
      });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function deleteTemplate() {
    if (!draft) return;
    if (!confirm(`Excluir o template "${draft.name}"?`)) return;
    try {
      await apiFetch(`/api/checklists/templates/${draft.id}`, { method: "DELETE" });
      setSelectedId(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function saveAll() {
    if (!draft) return;
    setSaving(true);
    setError("");
    try {
      // 1) Update metadata
      await apiFetch(`/api/checklists/templates/${draft.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: draft.name,
          description: draft.description,
          status: draft.status,
          estimatedMinutes: draft.estimatedMinutes
        })
      });
      // 2) Replace structure
      await apiFetch(`/api/checklists/templates/${draft.id}`, {
        method: "PUT",
        body: JSON.stringify({ sections: draft.sections })
      });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function mutateDraft(fn: (d: Template) => void) {
    if (!draft) return;
    const next = JSON.parse(JSON.stringify(draft)) as Template;
    fn(next);
    setDraft(next);
    setDirty(true);
  }

  function addSection() {
    mutateDraft(d => {
      d.sections.push({ name: `Seção ${d.sections.length + 1}`, sortOrder: d.sections.length, items: [] });
    });
  }

  function removeSection(sIdx: number) {
    mutateDraft(d => {
      d.sections.splice(sIdx, 1);
    });
  }

  function updateSection(sIdx: number, name: string) {
    mutateDraft(d => { d.sections[sIdx].name = name; });
  }

  function addItem(sIdx: number, itemType: ItemType) {
    mutateDraft(d => {
      const section = d.sections[sIdx];
      section.items.push({
        description: itemType === "CHECKBOX" ? "Novo item" : itemType === "NOTE" ? "Nova nota" : "Nova foto",
        itemType,
        isRequired: false,
        helpText: null,
        sortOrder: section.items.length
      });
    });
  }

  function removeItem(sIdx: number, iIdx: number) {
    mutateDraft(d => { d.sections[sIdx].items.splice(iIdx, 1); });
  }

  function updateItem(sIdx: number, iIdx: number, patch: Partial<TemplateItem>) {
    mutateDraft(d => { Object.assign(d.sections[sIdx].items[iIdx], patch); });
  }

  const totalItems = useMemo(() => draft?.sections.reduce((a, s) => a + s.items.length, 0) ?? 0, [draft]);
  const requiredItems = useMemo(
    () => draft?.sections.reduce((a, s) => a + s.items.filter(i => i.isRequired).length, 0) ?? 0,
    [draft]
  );

  return (
    <>
      <PageHeader
        title="Checklists"
        subtitle="Templates reutilizáveis vinculados a serviços"
        actions={
          <>
            <button type="button" className="btn btn-ghost" disabled>
              <FileText size={15} /> Histórico
            </button>
            <button type="button" className="btn btn-primary" onClick={createTemplate} disabled={creating}>
              <Plus size={15} /> {creating ? "Criando..." : "Novo template"}
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
          {/* Stats */}
          <div className="grid cols-4" style={{ marginBottom: 16 }}>
            <SmallStat label="Templates ativos" value={data.stats.activeCount} icon={<ListChecks size={20} />} variant="success" />
            <SmallStat label="Pausados" value={data.stats.pausedCount} icon={<Pause size={20} />} variant="warning" />
            <SmallStat label="Em rascunho" value={data.stats.draftCount} icon={<FileText size={20} />} variant="info" />
            <SmallStat label="Execuções totais" value={data.stats.totalInstances} icon={<CheckSquare size={20} />} variant="info" />
          </div>

          <div className="grid" style={{ gridTemplateColumns: "minmax(260px, 320px) 1fr", gap: 16 }}>
            {/* Sidebar */}
            <aside className="panel">
              <div className="panel__head">
                <div>
                  <div className="panel__title">Templates</div>
                  <div className="panel__sub">{data.templates.length} no total</div>
                </div>
              </div>
              <div className="panel__body panel__body--flush">
                {data.templates.length === 0 ? (
                  <div className="empty">
                    Nenhum template ainda. Clique em &ldquo;Novo template&rdquo; para criar.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {data.templates.map(t => {
                      const active = t.id === selectedId;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSelectedId(t.id)}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                            padding: "14px 20px",
                            borderLeft: active ? "3px solid var(--primary)" : "3px solid transparent",
                            background: active ? "var(--primary-ghost)" : "transparent",
                            border: 0,
                            borderBottom: "1px solid var(--border)",
                            cursor: "pointer",
                            textAlign: "left",
                            transition: "background 0.15s"
                          }}
                          onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--surface-muted)"; }}
                          onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                            <strong style={{ fontSize: 13.5 }}>{t.name}</strong>
                            <span className={`pill ${STATUS_CLASS[t.status]}`}>{STATUS_LABELS[t.status]}</span>
                          </div>
                          <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                            {t.sections.reduce((a, s) => a + s.items.length, 0)} itens · {t._count?.instances ?? 0} execuções
                          </div>
                          {t.services.length > 0 ? (
                            <div style={{ fontSize: 11, color: "var(--muted)" }}>
                              Serviços: {t.services.map(s => s.name).join(", ")}
                            </div>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </aside>

            {/* Editor */}
            <section className="panel">
              {!draft ? (
                <div className="empty-state">
                  <div className="empty-state__icon"><ListChecks size={24} /></div>
                  <h3>Selecione um template à esquerda</h3>
                  <p>Ou crie um novo para começar a configurar suas listas de verificação.</p>
                </div>
              ) : (
                <>
                  <div className="panel__head" style={{ flexDirection: "column", alignItems: "stretch", gap: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 240 }}>
                        <input
                          className="input"
                          value={draft.name}
                          onChange={e => mutateDraft(d => { d.name = e.target.value; })}
                          style={{ fontSize: 18, fontWeight: 700, border: "none", padding: 0, height: "auto", background: "transparent" }}
                        />
                        <textarea
                          className="textarea"
                          placeholder="Descrição do template..."
                          value={draft.description ?? ""}
                          onChange={e => mutateDraft(d => { d.description = e.target.value || null; })}
                          rows={2}
                          style={{ marginTop: 6, border: "none", padding: 0, background: "transparent", fontSize: 13, color: "var(--muted)" }}
                        />
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <span className={`pill ${STATUS_CLASS[draft.status]}`}>{STATUS_LABELS[draft.status]}</span>
                        {draft.status === "ACTIVE" ? (
                          <button type="button" className="btn btn-sm btn-ghost" onClick={() => toggleStatus("PAUSED")}>
                            <Pause size={13} /> Pausar
                          </button>
                        ) : (
                          <button type="button" className="btn btn-sm btn-ghost" onClick={() => toggleStatus("ACTIVE")}>
                            <Play size={13} /> Ativar
                          </button>
                        )}
                        <button type="button" className="btn btn-sm btn-ghost" onClick={duplicateTemplate}>
                          <Copy size={13} /> Duplicar
                        </button>
                        <button type="button" className="btn btn-sm btn-danger-ghost" onClick={deleteTemplate}>
                          <Trash2 size={13} /> Excluir
                        </button>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--muted)", flexWrap: "wrap" }}>
                      <span>{draft.sections.length} seções · {totalItems} itens · {requiredItems} obrigatórios</span>
                      {draft._count?.instances ? <span>· {draft._count.instances} execuções</span> : null}
                      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                        <label style={{ fontSize: 12 }}>Tempo estimado (min):</label>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          value={draft.estimatedMinutes ?? ""}
                          onChange={e => mutateDraft(d => { d.estimatedMinutes = e.target.value ? Number(e.target.value) : null; })}
                          style={{ width: 80, height: 32 }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="panel__body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {draft.sections.map((section, sIdx) => (
                      <div key={sIdx} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "var(--surface-muted)", borderBottom: "1px solid var(--border)" }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: "var(--muted)" }}>{sIdx + 1}.</span>
                          <input
                            className="input"
                            value={section.name}
                            onChange={e => updateSection(sIdx, e.target.value)}
                            style={{ flex: 1, fontWeight: 600, border: "none", background: "transparent", padding: 0, height: "auto" }}
                          />
                          <button type="button" className="btn btn-sm btn-danger-ghost" onClick={() => removeSection(sIdx)} title="Excluir seção">
                            <X size={13} />
                          </button>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 12 }}>
                          {section.items.map((item, iIdx) => (
                            <div key={iIdx} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--surface)" }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--muted)", minWidth: 80 }}>
                                {ITEM_ICON[item.itemType]} {ITEM_LABEL[item.itemType]}
                              </span>
                              <input
                                className="input"
                                value={item.description}
                                onChange={e => updateItem(sIdx, iIdx, { description: e.target.value })}
                                style={{ flex: 1, border: "none", background: "transparent", padding: "4px 6px", height: "auto" }}
                              />
                              <label style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--muted)", cursor: "pointer" }}>
                                <input
                                  type="checkbox"
                                  checked={item.isRequired}
                                  onChange={e => updateItem(sIdx, iIdx, { isRequired: e.target.checked })}
                                />
                                <span>Obrigatório</span>
                              </label>
                              <button type="button" className="btn btn-sm btn-danger-ghost" onClick={() => removeItem(sIdx, iIdx)} title="Excluir item">
                                <X size={13} />
                              </button>
                            </div>
                          ))}
                          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                            <button type="button" className="btn btn-sm btn-ghost" onClick={() => addItem(sIdx, "CHECKBOX")}>
                              <CheckSquare size={13} /> + Checkbox
                            </button>
                            <button type="button" className="btn btn-sm btn-ghost" onClick={() => addItem(sIdx, "NOTE")}>
                              <StickyNote size={13} /> + Nota
                            </button>
                            <button type="button" className="btn btn-sm btn-ghost" onClick={() => addItem(sIdx, "PHOTO")}>
                              <Camera size={13} /> + Foto
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}

                    <button type="button" className="btn btn-ghost" onClick={addSection} style={{ alignSelf: "start" }}>
                      <Plus size={14} /> Adicionar seção
                    </button>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                      <span style={{ fontSize: 12, color: "var(--muted)", alignSelf: "center" }}>
                        {dirty ? "Alterações não salvas" : "Sincronizado"}
                      </span>
                      <button type="button" className="btn btn-primary" onClick={saveAll} disabled={saving || !dirty}>
                        <Save size={14} /> {saving ? "Salvando..." : "Salvar template"}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>
        </>
      )}
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
