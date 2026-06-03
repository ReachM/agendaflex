"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Briefcase,
  Calendar,
  Clock,
  Pencil,
  Plus,
  Save,
  UserPlus,
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
    appointmentsToday: number;
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
    revenueToday: number;
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

/** Map UI grid order (Seg..Dom) → JS getDay() (Dom=0..Sáb=6) */
const WEEK_GRID = [
  { short: "Seg", jsDay: 1, key: "monday" as Weekday },
  { short: "Ter", jsDay: 2, key: "tuesday" as Weekday },
  { short: "Qua", jsDay: 3, key: "wednesday" as Weekday },
  { short: "Qui", jsDay: 4, key: "thursday" as Weekday },
  { short: "Sex", jsDay: 5, key: "friday" as Weekday },
  { short: "Sáb", jsDay: 6, key: "saturday" as Weekday },
  { short: "Dom", jsDay: 0, key: "sunday" as Weekday }
];

const COVER_VARIANTS = ["a", "b", "c", "d", "e", "f"] as const;
type CoverVariant = (typeof COVER_VARIANTS)[number];

const COVER_BAR_GRADIENT: Record<CoverVariant, string> = {
  a: "linear-gradient(90deg, #0d9488, #14b8a6)",
  b: "linear-gradient(90deg, #2563eb, #60a5fa)",
  c: "linear-gradient(90deg, #d97706, #fbbf24)",
  d: "linear-gradient(90deg, #9333ea, #a855f7)",
  e: "linear-gradient(90deg, #db2777, #f472b6)",
  f: "linear-gradient(90deg, #16a34a, #4ade80)"
};

const AVATAR_COLORS = [
  "#0d9488", "#2563eb", "#d97706", "#9333ea",
  "#dc2626", "#16a34a", "#0891b2", "#c2410c"
];

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function getInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";
}

function hashString(s: string): number {
  let h = 0;
  for (const c of s) h = c.charCodeAt(0) + ((h << 5) - h);
  return Math.abs(h);
}

function getCoverVariant(id: string): CoverVariant {
  return COVER_VARIANTS[hashString(id) % COVER_VARIANTS.length];
}

function getAvatarColor(name: string): string {
  return AVATAR_COLORS[hashString(name) % AVATAR_COLORS.length];
}

function parseSpecialties(specialty: string | null): string[] {
  if (!specialty) return [];
  return specialty
    .split(/[,;]/)
    .map(s => s.trim())
    .filter(Boolean);
}

function workDaysFromHours(wh: WorkingHours | null): number[] {
  if (!wh) return [];
  const result: number[] = [];
  for (const entry of WEEK_GRID) {
    if (wh[entry.key]?.open) result.push(entry.jsDay);
  }
  return result;
}

function formatHoursLabel(wh: WorkingHours | null): string {
  if (!wh) return "Sem horários definidos";

  type Range = { from: string; to: string };
  const groups: { days: string[]; range: Range }[] = [];

  for (const entry of WEEK_GRID) {
    const day = wh[entry.key];
    if (!day?.open || !day.from || !day.to) continue;
    const range = { from: day.from, to: day.to };
    const last = groups[groups.length - 1];
    if (last && last.range.from === range.from && last.range.to === range.to) {
      last.days.push(entry.short);
    } else {
      groups.push({ days: [entry.short], range });
    }
  }

  if (groups.length === 0) return "Sem horários definidos";

  function fmtRange(g: { days: string[]; range: Range }) {
    const span = g.days.length > 1 ? `${g.days[0]}-${g.days[g.days.length - 1]}` : g.days[0];
    return `${span} ${g.range.from}–${g.range.to}`;
  }

  return groups.map(fmtRange).join(" · ");
}

type ProfessionalStatus = "available" | "in_service" | "off_today" | "inactive";

function deriveStatus(pro: Professional): { status: ProfessionalStatus; label: string } {
  if (!pro.isActive) return { status: "inactive", label: "Inativo" };

  const today = new Date().getDay();
  const worksToday = workDaysFromHours(pro.workingHours).includes(today);
  if (!worksToday) return { status: "off_today", label: "Folga hoje" };

  if (pro.nextAppointmentAt) {
    const nextAt = new Date(pro.nextAppointmentAt);
    const diffMin = (nextAt.getTime() - Date.now()) / 60000;
    if (diffMin < 0 && diffMin > -180) {
      return { status: "in_service", label: "Em atendimento" };
    }
  }
  return { status: "available", label: "Disponível" };
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

  // ── Derivados para o summary ────────────────────────
  const availableNow = useMemo(() => {
    if (!data) return 0;
    return data.professionals.filter(p => deriveStatus(p).status === "available").length;
  }, [data]);

  const modalOpen = creating || editing;

  return (
    <>
      <PageHeader
        title="Profissionais"
        subtitle="Gerencie a equipe, horários de trabalho e serviços oferecidos por cada um."
        actions={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => alert("Horários padrão em breve.")}>
              <Clock size={15} />
              Horários padrão
            </button>
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              <UserPlus size={15} />
              Adicionar profissional
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
          {/* Summary */}
          <section className="summary">
            <div className="summary-card">
              <div className="v">{data.metrics.totalProfessionals}</div>
              <div className="l">Total de profissionais</div>
            </div>
            <div className="summary-card">
              <div className="v" style={{ color: "var(--success)" }}>{availableNow}</div>
              <div className="l">Disponíveis agora</div>
            </div>
            <div className="summary-card">
              <div className="v" style={{ color: "var(--accent)" }}>{data.metrics.avgOccupancy}%</div>
              <div className="l">Ocupação média</div>
            </div>
            <div className="summary-card">
              <div className="v">{formatMoney(data.metrics.revenueToday)}</div>
              <div className="l">Receita gerada hoje</div>
            </div>
          </section>

          {/* Grid de cards */}
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
            <section className="pros-grid">
              {data.professionals.map(p => (
                <ProfessionalCard
                  key={p.id}
                  professional={p}
                  onEdit={() => openEdit(p)}
                />
              ))}

              <button type="button" className="pro-add" onClick={openCreate}>
                <Plus size={38} strokeWidth={1.8} />
                <div className="t">Adicionar profissional</div>
                <div className="s">Configure nome, especialidades e horários de atendimento</div>
              </button>
            </section>
          )}
        </>
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
                  <input className="input" value={form.specialty} onChange={e => setForm({ ...form, specialty: e.target.value })} placeholder="Ex.: Cabelo, Coloração, Hidratação" />
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

function ProfessionalCard({
  professional: pro,
  onEdit
}: {
  professional: Professional;
  onEdit: () => void;
}) {
  const today = new Date().getDay();
  const variant = getCoverVariant(pro.id);
  const initials = getInitials(pro.name);
  const avatarColor = getAvatarColor(pro.name);
  const specialties = parseSpecialties(pro.specialty);
  const workDays = workDaysFromHours(pro.workingHours);
  const hoursLabel = formatHoursLabel(pro.workingHours);
  const { status, label } = deriveStatus(pro);
  const isOff = status !== "available" && status !== "in_service";

  return (
    <article className="pro">
      <div className={`pro__cover pro__cover--${variant}`}>
        <span className={`pro__status${isOff ? " pro__status--off" : ""}`}>
          <span className="dot" />
          {label}
        </span>
      </div>

      <div className="pro__head">
        <div className="pro__head-row">
          <div className="pro__avt" style={{ background: avatarColor }}>
            {initials}
          </div>
        </div>

        <div className="pro__name">{pro.name}</div>
        {specialties.length > 0 ? (
          <div className="pro__role">{specialties[0]}</div>
        ) : null}

        {specialties.length > 0 ? (
          <div className="pro__tags">
            {specialties.slice(0, 3).map(s => (
              <span key={s} className="chip">{s}</span>
            ))}
            {specialties.length > 3 ? (
              <span className="chip">+{specialties.length - 3}</span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="pro__stats">
        <div>
          <div className="v">{pro.stats.appointmentsToday}</div>
          <div className="l">Hoje</div>
        </div>
        <div>
          <div className="v">{pro.stats.occupancyRate > 0 ? `${pro.stats.occupancyRate}%` : "—"}</div>
          <div className="l">Ocupação</div>
        </div>
        <div>
          <div className="v">{pro.stats.completedTotal}</div>
          <div className="l">Concluídos</div>
        </div>
      </div>

      <div className="pro__schedule">
        <div className="lbl">Disponibilidade semanal</div>
        <div className="week">
          {WEEK_GRID.map(({ short, jsDay }) => {
            const isToday = jsDay === today;
            const isOn = workDays.includes(jsDay);
            const cls = isToday ? "today" : isOn ? "on" : "off";
            return (
              <div key={short} className={`week__day ${cls}`}>
                {short}
              </div>
            );
          })}
        </div>

        <div className="pro__hours">
          <Clock size={13} />
          {hoursLabel}
        </div>

        <div className="occ">
          <div style={{ width: `${pro.stats.occupancyRate}%`, background: COVER_BAR_GRADIENT[variant] }} />
        </div>
      </div>

      <div className="pro__foot">
        <Link href={`/agenda?professional=${pro.id}`} className="btn btn-ghost btn-sm">
          <Calendar size={13} />
          Ver agenda
        </Link>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onEdit}>
          <Pencil size={13} />
          Editar
        </button>
      </div>
    </article>
  );
}
