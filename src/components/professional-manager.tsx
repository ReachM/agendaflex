"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Briefcase,
  CalendarDays,
  Clock,
  DollarSign,
  Edit2,
  Plus,
  Save,
  Users,
  X
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { apiFetch } from "@/lib/client-api";

type Weekday = "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";

type DayHours = { open: boolean; from?: string; to?: string };

type WorkingHours = Partial<Record<Weekday, DayHours>>;

type Service = { id: string; name: string };

type Professional = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  specialty: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  isPublic: boolean;
  workingHours: WorkingHours | null;
  services: Service[];
  serviceIds: string[];
  stats: {
    appointmentsLast30d: number;
    completedTotal: number;
    revenueTotal: number;
    revenueCount: number;
    avgTicket: number;
    bookedHoursLast30d: number;
    availableHoursLast30d: number;
    occupancyRate: number;
  };
  nextAppointmentAt: string | null;
};

type Response = {
  professionals: Professional[];
  metrics: {
    totalProfessionals: number;
    activeProfessionals: number;
    avgOccupancy: number;
    totalRevenue: number;
  };
};

const WEEKDAYS: { id: Weekday; label: string; short: string }[] = [
  { id: "monday", label: "Segunda", short: "Seg" },
  { id: "tuesday", label: "Terça", short: "Ter" },
  { id: "wednesday", label: "Quarta", short: "Qua" },
  { id: "thursday", label: "Quinta", short: "Qui" },
  { id: "friday", label: "Sexta", short: "Sex" },
  { id: "saturday", label: "Sábado", short: "Sáb" },
  { id: "sunday", label: "Domingo", short: "Dom" }
];

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

function formatRelative(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  const diff = date.getTime() - Date.now();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `em ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `em ${hours}h`;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

const EMPTY_WH: WorkingHours = {
  monday:    { open: true, from: "09:00", to: "18:00" },
  tuesday:   { open: true, from: "09:00", to: "18:00" },
  wednesday: { open: true, from: "09:00", to: "18:00" },
  thursday:  { open: true, from: "09:00", to: "18:00" },
  friday:    { open: true, from: "09:00", to: "18:00" },
  saturday:  { open: false },
  sunday:    { open: false }
};

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  specialty: "",
  avatarUrl: "",
  isActive: true,
  isPublic: true,
  serviceIds: [] as string[],
  workingHours: EMPTY_WH
};

type FormState = typeof EMPTY_FORM;

export function ProfessionalManager() {
  const [data, setData] = useState<Response | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Professional | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const load = useCallback(async () => {
    try {
      const [profs, svcs] = await Promise.all([
        apiFetch<Response>("/api/professionals"),
        apiFetch<{ services: Service[] }>("/api/services")
      ]);
      setData(profs);
      setServices(svcs.services);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function openCreate() {
    setForm({ ...EMPTY_FORM, workingHours: { ...EMPTY_WH } });
    setCreating(true);
  }

  function openEdit(p: Professional) {
    setForm({
      name: p.name,
      email: p.email ?? "",
      phone: p.phone ?? "",
      specialty: p.specialty ?? "",
      avatarUrl: p.avatarUrl ?? "",
      isActive: p.isActive,
      isPublic: p.isPublic,
      serviceIds: p.serviceIds,
      workingHours: p.workingHours ?? { ...EMPTY_WH }
    });
    setEditing(p);
  }

  function closeModal() {
    setEditing(null);
    setCreating(false);
    setError("");
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        specialty: form.specialty || undefined,
        avatarUrl: form.avatarUrl || undefined,
        isActive: form.isActive,
        isPublic: form.isPublic,
        serviceIds: form.serviceIds,
        workingHours: form.workingHours
      };
      if (editing) {
        await apiFetch(`/api/professionals/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await apiFetch("/api/professionals", { method: "POST", body: JSON.stringify(payload) });
      }
      closeModal();
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: Professional) {
    try {
      await apiFetch(`/api/professionals/${p.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !p.isActive })
      });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function updateDay(day: Weekday, patch: Partial<DayHours>) {
    setForm(prev => ({
      ...prev,
      workingHours: {
        ...prev.workingHours,
        [day]: { open: prev.workingHours[day]?.open ?? false, from: prev.workingHours[day]?.from ?? "09:00", to: prev.workingHours[day]?.to ?? "18:00", ...patch }
      }
    }));
  }

  function toggleService(id: string) {
    setForm(prev => ({
      ...prev,
      serviceIds: prev.serviceIds.includes(id)
        ? prev.serviceIds.filter(s => s !== id)
        : [...prev.serviceIds, id]
    }));
  }

  const modalOpen = creating || editing;

  return (
    <>
      <PageHeader
        title="Profissionais"
        subtitle={data ? `${data.metrics.activeProfessionals} ativos · ocupação média ${data.metrics.avgOccupancy}%` : "Equipe de atendimento"}
        actions={
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <Plus size={15} /> Adicionar profissional
          </button>
        }
      />

      {error ? <div className="error-box">{error}</div> : null}

      {data ? (
        <>
          {/* KPIs */}
          <div className="grid cols-3" style={{ marginBottom: 16 }}>
            <div className="stat-card stat-card--info">
              <div className="stat-card__header">
                <div>
                  <div className="stat-card__label">Profissionais</div>
                  <div className="stat-card__value">{data.metrics.totalProfessionals}</div>
                </div>
                <div className="stat-card__icon"><Users size={18} /></div>
              </div>
              <div className="stat-card__footer">{data.metrics.activeProfessionals} ativos</div>
            </div>
            <div className="stat-card stat-card--warning">
              <div className="stat-card__header">
                <div>
                  <div className="stat-card__label">Ocupação média (30d)</div>
                  <div className="stat-card__value">{data.metrics.avgOccupancy}%</div>
                </div>
                <div className="stat-card__icon"><Activity size={18} /></div>
              </div>
            </div>
            <div className="stat-card stat-card--success">
              <div className="stat-card__header">
                <div>
                  <div className="stat-card__label">Receita gerada</div>
                  <div className="stat-card__value" style={{ fontSize: 22 }}>{formatMoney(data.metrics.totalRevenue)}</div>
                </div>
                <div className="stat-card__icon"><DollarSign size={18} /></div>
              </div>
              <div className="stat-card__footer">Atendimentos concluídos</div>
            </div>
          </div>

          {/* Professional cards grid */}
          {data.professionals.length === 0 ? (
            <section className="panel">
              <div className="panel__body">
                <div className="empty-state">
                  <div className="empty-state__icon"><Users size={24} /></div>
                  <h3>Nenhum profissional cadastrado</h3>
                  <p>Adicione profissionais para começar a aceitar agendamentos.</p>
                </div>
              </div>
            </section>
          ) : (
            <div className="grid cols-3" style={{ gap: 16 }}>
              {data.professionals.map((p, idx) => {
                const occupancyClass = p.stats.occupancyRate >= 70 ? "var(--success)" : p.stats.occupancyRate >= 40 ? "var(--warning)" : "var(--muted)";
                return (
                  <section key={p.id} className="panel" style={{ overflow: "hidden" }}>
                    <div className="panel__body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ display: "flex", gap: 12 }}>
                        {p.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.avatarUrl} alt={p.name} style={{ width: 52, height: 52, borderRadius: 12, objectFit: "cover" }} />
                        ) : (
                          <div className={`avatar avatar--lg av-${(idx % 8) + 1}`} style={{ borderRadius: 12 }}>{initials(p.name)}</div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <strong style={{ fontSize: 15 }}>{p.name}</strong>
                            <span className={`pill ${p.isActive ? "pill--success" : "pill--muted"}`}>
                              {p.isActive ? "Ativo" : "Inativo"}
                            </span>
                          </div>
                          {p.specialty ? <div style={{ fontSize: 12, color: "var(--muted)" }}>{p.specialty}</div> : null}
                          {p.phone ? <div style={{ fontSize: 11, color: "var(--muted)" }}>{p.phone}</div> : null}
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 12, color: "var(--text-secondary)" }}>
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span>Ocupação 30d</span>
                            <strong style={{ color: occupancyClass }}>{p.stats.occupancyRate}%</strong>
                          </div>
                          <div className="progress-bar" style={{ height: 6 }}>
                            <div className="progress-bar__fill" style={{ width: `${p.stats.occupancyRate}%`, background: occupancyClass }} />
                          </div>
                          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                            {p.stats.bookedHoursLast30d}h de {p.stats.availableHoursLast30d}h
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>Receita</div>
                          <strong style={{ fontSize: 14, color: "var(--primary)" }}>{formatMoney(p.stats.revenueTotal)}</strong>
                          <div style={{ fontSize: 10, color: "var(--muted)" }}>
                            {p.stats.completedTotal} atendimentos
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {p.services.length === 0 ? (
                          <span style={{ fontSize: 11, color: "var(--muted)" }}>Sem serviços vinculados</span>
                        ) : (
                          <>
                            {p.services.slice(0, 4).map(s => (
                              <span key={s.id} className="pill pill--muted" style={{ fontSize: 10 }}>{s.name}</span>
                            ))}
                            {p.services.length > 4 ? <span style={{ fontSize: 11, color: "var(--muted)" }}>+{p.services.length - 4}</span> : null}
                          </>
                        )}
                      </div>

                      {p.nextAppointmentAt ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--muted)", padding: "6px 8px", background: "var(--surface-muted)", borderRadius: 6 }}>
                          <Clock size={11} /> Próximo: {formatRelative(p.nextAppointmentAt)}
                        </div>
                      ) : null}

                      <div style={{ display: "flex", gap: 6, marginTop: "auto" }}>
                        <Link href={`/agenda?professional=${p.id}`} className="btn btn-sm btn-ghost" style={{ flex: 1 }}>
                          <CalendarDays size={12} /> Agenda
                        </Link>
                        <button type="button" className="btn btn-sm btn-ghost" onClick={() => openEdit(p)} style={{ flex: 1 }}>
                          <Edit2 size={12} /> Editar
                        </button>
                        <button type="button" className={`btn btn-sm ${p.isActive ? "btn-danger-ghost" : "btn-ghost"}`} onClick={() => toggleActive(p)} title={p.isActive ? "Desativar" : "Ativar"}>
                          {p.isActive ? "Pausar" : "Ativar"}
                        </button>
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <div className="loading-spinner" />
        </div>
      )}

      {/* Edit/Create modal */}
      {modalOpen ? (
        <div className="modal-overlay" onClick={closeModal} role="dialog" aria-modal="true">
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 760 }}>
            <div className="preview-modal__header">
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                {editing ? "Editar profissional" : "Novo profissional"}
              </h2>
              <button type="button" className="icon-button secondary" onClick={closeModal} aria-label="Fechar">
                <X size={16} />
              </button>
            </div>

            {error ? <div className="error-box" style={{ marginTop: 16 }}>{error}</div> : null}

            <form onSubmit={submit} style={{ display: "grid", gap: 16, marginTop: 16 }}>
              <div className="form-grid">
                <div className="field full">
                  <label>Nome *</label>
                  <input className="input" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="field">
                  <label>Especialidade</label>
                  <input className="input" value={form.specialty} onChange={e => setForm({ ...form, specialty: e.target.value })} placeholder="Ex.: Cabeleireira, Manicure" />
                </div>
                <div className="field">
                  <label>Telefone</label>
                  <input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="field">
                  <label>E-mail</label>
                  <input className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="field">
                  <label>URL do avatar (opcional)</label>
                  <input className="input" type="url" value={form.avatarUrl} onChange={e => setForm({ ...form, avatarUrl: e.target.value })} placeholder="https://..." />
                </div>
                <div className="field">
                  <label className="checkbox-line">
                    <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
                    <span>Ativo</span>
                  </label>
                </div>
                <div className="field">
                  <label className="checkbox-line">
                    <input type="checkbox" checked={form.isPublic} onChange={e => setForm({ ...form, isPublic: e.target.checked })} />
                    <span>Visível na página pública</span>
                  </label>
                </div>
              </div>

              {/* Working hours */}
              <div className="panel" style={{ marginTop: 0 }}>
                <div className="panel__head">
                  <div>
                    <div className="panel__title">
                      <Clock size={14} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px" }} />
                      Horário de trabalho
                    </div>
                    <div className="panel__sub">Define quando este profissional aceita agendamentos</div>
                  </div>
                </div>
                <div className="panel__body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {WEEKDAYS.map(({ id, label }) => {
                    const day = form.workingHours[id] ?? { open: false };
                    return (
                      <div key={id} style={{ display: "grid", gridTemplateColumns: "120px auto 1fr 1fr", alignItems: "center", gap: 10, padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: day.open ? "var(--surface)" : "var(--surface-muted)" }}>
                        <strong style={{ fontSize: 13 }}>{label}</strong>
                        <label className="switch">
                          <input type="checkbox" checked={day.open ?? false} onChange={e => updateDay(id, { open: e.target.checked })} />
                          <span className="switch__track" />
                        </label>
                        {day.open ? (
                          <>
                            <input className="input" type="time" value={day.from ?? "09:00"} onChange={e => updateDay(id, { from: e.target.value })} style={{ height: 32 }} />
                            <input className="input" type="time" value={day.to ?? "18:00"} onChange={e => updateDay(id, { to: e.target.value })} style={{ height: 32 }} />
                          </>
                        ) : (
                          <span style={{ gridColumn: "3 / span 2", fontSize: 12, color: "var(--muted)" }}>Fechado</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Services */}
              <div className="panel">
                <div className="panel__head">
                  <div>
                    <div className="panel__title">
                      <Briefcase size={14} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px" }} />
                      Serviços que executa
                    </div>
                    <div className="panel__sub">Selecione os serviços atendidos por este profissional</div>
                  </div>
                </div>
                <div className="panel__body">
                  {services.length === 0 ? (
                    <div className="empty">Nenhum serviço cadastrado ainda.</div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 6 }}>
                      {services.map(s => {
                        const checked = form.serviceIds.includes(s.id);
                        return (
                          <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", border: `1px solid ${checked ? "var(--primary)" : "var(--border)"}`, borderRadius: "var(--radius-sm)", background: checked ? "var(--primary-ghost)" : "var(--surface)", cursor: "pointer", fontSize: 13 }}>
                            <input type="checkbox" checked={checked} onChange={() => toggleService(s.id)} />
                            <span>{s.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  <Save size={14} /> {saving ? "Salvando..." : editing ? "Salvar alterações" : "Criar profissional"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
