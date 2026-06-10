"use client";

import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  MessageCircle,
  Moon,
  Scissors,
  Shield,
  Sun,
  Sunset
} from "lucide-react";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import "./public-booking.css";

type CompanyInfo = {
  name: string;
  tradeName: string;
  phone?: string | null;
  segment: string;
  isHealthSegment: boolean;
  businessHours?: Record<string, { open: boolean; from?: string; to?: string }> | null;
};
type Service = { id: string; name: string; description: string; basePrice: string; durationMinutes: number };
type Professional = { id: string; name: string; specialty: string };
type Slot = { time: string; startAt: string; endAt: string; available: boolean };
type Settings = {
  allowChooseProfessional: boolean;
  minNoticeHours: number;
  maxDaysAhead: number;
  slotIntervalMinutes: number;
  instructions: string | null;
  confirmationMessage: string | null;
  requireManualApproval: boolean;
  primaryColor?: string | null;
};

function shadeHex(hex: string, amount: number): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;
  const r = Math.max(0, Math.min(255, parseInt(clean.slice(0, 2), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(clean.slice(2, 4), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(clean.slice(4, 6), 16) + amount));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function brandPalette(primary: string): React.CSSProperties {
  return {
    ["--pb-brand" as never]: primary,
    ["--pb-brand-hover" as never]: shadeHex(primary, -24),
    ["--pb-brand-light" as never]: hexToRgba(primary, 0.18),
    ["--pb-brand-ghost" as never]: hexToRgba(primary, 0.08)
  };
}

const DOW_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTH_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function formatMoney(v?: string | number | null) {
  if (v === null || v === undefined || v === "") return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));
}

function formatDateLong(dateStr: string) {
  const d = new Date(`${dateStr}T12:00:00`);
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(d);
}

function toLocalISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildDateChips(minDate: string, maxDate: string) {
  const start = new Date(`${minDate}T12:00:00`);
  const end = new Date(`${maxDate}T12:00:00`);
  const chips: { value: string; dow: string; num: string; mon: string }[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    chips.push({
      value: toLocalISODate(d),
      dow: DOW_LABELS[d.getDay()],
      num: String(d.getDate()).padStart(2, "0"),
      mon: MONTH_SHORT[d.getMonth()]
    });
    if (chips.length >= 21) break;
  }
  return chips;
}

function groupSlots(slots: Slot[]) {
  const morning: Slot[] = [];
  const afternoon: Slot[] = [];
  const evening: Slot[] = [];
  for (const s of slots) {
    const hour = Number((s.time ?? "00:00").split(":")[0] ?? 0);
    if (hour < 12) morning.push(s);
    else if (hour < 18) afternoon.push(s);
    else evening.push(s);
  }
  return { morning, afternoon, evening };
}

export default function PublicBookingPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [step, setStep] = useState(1);

  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    notes: "",
    cpf: "",
    serviceId: "",
    professionalId: "",
    date: "",
    time: "",
    startAt: "",
    endAt: "",
    lgpdAccepted: false,
    healthInsurance: "",
    healthInsuranceNumber: "",
    allergies: "",
    requiredCare: ""
  });

  useEffect(() => {
    fetch(`/api/public/${slug}/book`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Página não encontrada.");
        return r.json();
      })
      .then((data) => {
        setCompany(data.company);
        setServices(data.services);
        setProfessionals(data.professionals);
        setSettings(data.settings);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug]);

  const selectedService = useMemo(() => services.find((s) => s.id === form.serviceId), [form.serviceId, services]);
  const selectedProfessional = useMemo(
    () => professionals.find((p) => p.id === form.professionalId),
    [form.professionalId, professionals]
  );

  useEffect(() => {
    if (!form.date || !form.serviceId || !form.professionalId) {
      setSlots([]);
      return;
    }
    setLoadingSlots(true);
    setError("");
    fetch(`/api/public/${slug}/slots?date=${form.date}&serviceId=${form.serviceId}&professionalId=${form.professionalId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Erro ao carregar horários.");
        return r.json();
      })
      .then((data) => setSlots(data.slots ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoadingSlots(false));
  }, [form.date, form.serviceId, form.professionalId, slug]);

  function selectSlot(slot: Slot) {
    if (!slot.available) return;
    setForm({ ...form, time: slot.time, startAt: slot.startAt, endAt: slot.endAt });
  }

  const minDate = useMemo(() => {
    const noticeMs = (settings?.minNoticeHours ?? 1) * 60 * 60 * 1000;
    const d = new Date(Date.now() + noticeMs);
    return toLocalISODate(d);
  }, [settings]);

  const maxDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + (settings?.maxDaysAhead ?? 30));
    return toLocalISODate(d);
  }, [settings]);

  const dateChips = useMemo(() => buildDateChips(minDate, maxDate), [minDate, maxDate]);
  const groupedSlots = useMemo(() => groupSlots(slots), [slots]);

  const totalSteps = company?.isHealthSegment ? 5 : 4;
  const stepLabels = company?.isHealthSegment
    ? ["Serviço", "Horário", "Seus dados", "Saúde", "Confirmar"]
    : ["Serviço", "Horário", "Seus dados", "Confirmar"];

  function canAdvance(): boolean {
    switch (step) {
      case 1: return !!form.serviceId;
      case 2: return !!form.professionalId && !!form.date && !!form.startAt;
      case 3: return !!form.name && !!form.phone && form.lgpdAccepted;
      case 4: return true; // health step ou confirmação
      default: return true;
    }
  }

  function goNext() {
    if (step === 2 && settings?.allowChooseProfessional === false && professionals.length > 0 && !form.professionalId) {
      setForm({ ...form, professionalId: professionals[0].id });
    }
    setStep(step + 1);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/${slug}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao agendar.");
      setSuccess(data.message);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Loading state ─────────────────────────────────────────
  if (loading) {
    return (
      <div className="pb">
        <div className="pb__shell">
          <div className="pb-loading"><div className="pb-spin" /></div>
        </div>
      </div>
    );
  }

  // ─── Fatal error (company not found) ───────────────────────
  if (error && !company) {
    return (
      <div className="pb">
        <div className="pb__shell">
          <div className="pb-card" style={{ marginTop: 48 }}>
            <div className="pb-card__head">
              <h2>Página indisponível</h2>
              <p>{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const companyDisplay = company?.tradeName || company?.name || "Empresa";
  const initials = companyDisplay
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const brandStyle = brandPalette(settings?.primaryColor ?? "#0d9488");

  // ─── Success ──────────────────────────────────────────────
  if (success) {
    return (
      <div className="pb" style={brandStyle}>
        <div className="pb__shell">
          <Header companyDisplay={companyDisplay} initials={initials} phone={company?.phone ?? null} businessHours={company?.businessHours ?? null} />
          <div className="pb-card">
            <div className="pb-success">
              <div className="pb-success__icon"><Check size={36} /></div>
              <h2>Agendamento realizado!</h2>
              <p>{success}</p>
              {selectedService && (
                <div className="pb-success__details">
                  <div><strong>Serviço:</strong> {selectedService.name}</div>
                  {selectedProfessional && <div><strong>Profissional:</strong> {selectedProfessional.name}</div>}
                  <div><strong>Data:</strong> {form.date ? formatDateLong(form.date) : "—"}</div>
                  <div><strong>Horário:</strong> {form.time}</div>
                  <div><strong>Valor:</strong> {formatMoney(selectedService.basePrice)}</div>
                </div>
              )}
            </div>
          </div>
          <Footer companyDisplay={companyDisplay} />
        </div>
      </div>
    );
  }

  // ─── Main flow ────────────────────────────────────────────
  return (
    <div className="pb" style={brandStyle}>
      <div className="pb__shell">
        <Header companyDisplay={companyDisplay} initials={initials} phone={company?.phone ?? null} businessHours={company?.businessHours ?? null} />

        <section className="pb-hero">
          <h1>Agende seu horário em <em>poucos cliques</em></h1>
          <p>Escolha o serviço e o melhor horário disponível. A confirmação chega na hora.</p>
        </section>

        <Stepper labels={stepLabels} current={step} />

        {error && <div className="pb-error" role="alert">{error}</div>}

        <form onSubmit={submit}>
          {/* ─── Step 1: Serviço ─── */}
          {step === 1 && (
            <section className="pb-card">
              <div className="pb-card__head">
                <h2>Qual serviço você quer?</h2>
                <p>Selecione abaixo o serviço desejado.</p>
              </div>
              {settings?.instructions && (
                <div className="pb-warn" style={{ marginBottom: 16 }}>
                  <Shield size={14} />
                  <span>{settings.instructions}</span>
                </div>
              )}
              <div className="pb-svc-list">
                {services.length === 0 && (
                  <div style={{ gridColumn: "1 / -1", textAlign: "center", color: "var(--muted)", padding: 24 }}>
                    Nenhum serviço disponível no momento.
                  </div>
                )}
                {services.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    className={`pb-svc ${form.serviceId === s.id ? "is-on" : ""}`}
                    onClick={() => setForm({ ...form, serviceId: s.id })}
                  >
                    <div className="pb-svc__top">
                      <span className="pb-svc__ico"><Scissors size={18} /></span>
                      <div>
                        <div className="pb-svc__nm">{s.name}</div>
                      </div>
                    </div>
                    {s.description && <div className="pb-svc__desc">{s.description}</div>}
                    <div className="pb-svc__foot">
                      <span className="pb-svc__price">{formatMoney(s.basePrice)}</span>
                      <span className="pb-svc__dur">
                        <Clock size={11} /> {s.durationMinutes} min
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ─── Step 2: Profissional + data + horário ─── */}
          {step === 2 && (
            <>
              {settings?.allowChooseProfessional !== false && (
                <section className="pb-card">
                  <div className="pb-card__head">
                    <h2>Com quem você prefere?</h2>
                    <p>Selecione um profissional disponível.</p>
                  </div>
                  <div className="pb-pros">
                    {professionals.length === 0 && (
                      <div style={{ gridColumn: "1 / -1", textAlign: "center", color: "var(--muted)", padding: 16 }}>
                        Nenhum profissional disponível.
                      </div>
                    )}
                    {professionals.map((p) => {
                      const initialsP = p.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
                      return (
                        <button
                          type="button"
                          key={p.id}
                          className={`pb-pro ${form.professionalId === p.id ? "is-on" : ""}`}
                          onClick={() => setForm({ ...form, professionalId: p.id, date: "", time: "", startAt: "", endAt: "" })}
                        >
                          <div className="pb-pro__avt">{initialsP}</div>
                          <div className="pb-pro__nm">{p.name}</div>
                          {p.specialty && <div className="pb-pro__role">{p.specialty}</div>}
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              <section className="pb-card">
                <div className="pb-card__head">
                  <h2>Quando você quer vir?</h2>
                  <p>Escolha uma data nas próximas semanas.</p>
                </div>

                <div className="pb-dates" role="listbox" aria-label="Escolher data">
                  {dateChips.map((c) => (
                    <button
                      type="button"
                      key={c.value}
                      className={`pb-date ${form.date === c.value ? "is-on" : ""}`}
                      onClick={() => setForm({ ...form, date: c.value, time: "", startAt: "", endAt: "" })}
                    >
                      <div className="pb-date__dow">{c.dow}</div>
                      <div className="pb-date__num">{c.num}</div>
                      <div className="pb-date__mon">{c.mon}</div>
                    </button>
                  ))}
                </div>

                {!form.professionalId && (
                  <div className="pb-warn">Selecione um profissional para ver os horários.</div>
                )}

                {form.date && form.professionalId && (
                  loadingSlots ? (
                    <div className="pb-loading"><div className="pb-spin" /></div>
                  ) : slots.length === 0 ? (
                    <div className="pb-warn">Não há horários disponíveis nesse dia. Escolha outra data.</div>
                  ) : (
                    <SlotGrid groups={groupedSlots} selectedTime={form.time} onSelect={selectSlot} />
                  )
                )}
              </section>

              {form.startAt && selectedService && (
                <section className="pb-summary">
                  <div className="pb-summary__col">
                    <div className="pb-summary__lbl">Seu agendamento</div>
                    <div className="pb-summary__svc">{selectedService.name}</div>
                    <div className="pb-summary__when">
                      {selectedProfessional && <>com <strong>{selectedProfessional.name}</strong></>}
                      {form.date && <><span className="pip" /> <strong>{formatDateLong(form.date)}</strong></>}
                      {form.time && <><span className="pip" /> <strong>{form.time}</strong></>}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="pb-summary__price">{formatMoney(selectedService.basePrice)}</div>
                    <div className="pb-summary__hint">pagamento no local</div>
                  </div>
                </section>
              )}
            </>
          )}

          {/* ─── Step 3: Dados pessoais ─── */}
          {step === 3 && (
            <section className="pb-card">
              <div className="pb-card__head">
                <h2>Seus dados</h2>
                <p>Para confirmar e te avisar sobre o atendimento.</p>
              </div>
              <div className="pb-grid-2">
                <div className="pb-field">
                  <label htmlFor="pb-name">Nome completo *</label>
                  <input
                    id="pb-name"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Seu nome completo"
                    autoComplete="name"
                  />
                </div>
                <div className="pb-field">
                  <label htmlFor="pb-phone">Telefone/WhatsApp *</label>
                  <input
                    id="pb-phone"
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="(00) 00000-0000"
                    autoComplete="tel"
                    inputMode="tel"
                  />
                </div>
                <div className="pb-field">
                  <label htmlFor="pb-email">E-mail</label>
                  <input
                    id="pb-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="seu@email.com"
                    autoComplete="email"
                  />
                </div>
                <div className="pb-field">
                  <label htmlFor="pb-cpf">CPF</label>
                  <input
                    id="pb-cpf"
                    value={form.cpf}
                    onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                  />
                </div>
                <div className="pb-field full">
                  <label htmlFor="pb-notes">Observações</label>
                  <textarea
                    id="pb-notes"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Informações adicionais (opcional)"
                  />
                </div>
                <label className="pb-consent" style={{ gridColumn: "1 / -1" }}>
                  <input
                    type="checkbox"
                    checked={form.lgpdAccepted}
                    onChange={(e) => setForm({ ...form, lgpdAccepted: e.target.checked })}
                  />
                  <span>
                    <strong><Shield size={13} style={{ verticalAlign: -2, marginRight: 4 }} />LGPD:</strong>{" "}
                    Aceito a coleta e processamento dos meus dados pessoais conforme a política de privacidade
                    e a Lei Geral de Proteção de Dados.
                  </span>
                </label>
              </div>
            </section>
          )}

          {/* ─── Step 4 (saúde) ─── */}
          {step === 4 && company?.isHealthSegment && (
            <section className="pb-card">
              <div className="pb-card__head">
                <h2>Informações de saúde</h2>
                <p>Campos opcionais que ajudam o profissional a se preparar para o atendimento.</p>
              </div>
              <div className="pb-grid-2">
                <div className="pb-field">
                  <label htmlFor="pb-insurance">Convênio</label>
                  <input
                    id="pb-insurance"
                    value={form.healthInsurance}
                    onChange={(e) => setForm({ ...form, healthInsurance: e.target.value })}
                    placeholder="Nome do convênio"
                  />
                </div>
                <div className="pb-field">
                  <label htmlFor="pb-insurance-n">Nº da carteirinha</label>
                  <input
                    id="pb-insurance-n"
                    value={form.healthInsuranceNumber}
                    onChange={(e) => setForm({ ...form, healthInsuranceNumber: e.target.value })}
                    placeholder="Número"
                  />
                </div>
                <div className="pb-field full">
                  <label htmlFor="pb-allergies">Alergias</label>
                  <textarea
                    id="pb-allergies"
                    value={form.allergies}
                    onChange={(e) => setForm({ ...form, allergies: e.target.value })}
                    placeholder="Alergias conhecidas (opcional)"
                  />
                </div>
                <div className="pb-field full">
                  <label htmlFor="pb-care">Cuidados necessários</label>
                  <textarea
                    id="pb-care"
                    value={form.requiredCare}
                    onChange={(e) => setForm({ ...form, requiredCare: e.target.value })}
                    placeholder="Cuidados especiais (opcional)"
                  />
                </div>
              </div>
            </section>
          )}

          {/* ─── Step final: Confirmação ─── */}
          {step === totalSteps && (
            <section className="pb-card">
              <div className="pb-card__head">
                <h2>Confirmar agendamento</h2>
                <p>Revise os dados antes de finalizar.</p>
              </div>

              <div className="pb-success__details" style={{ margin: 0, maxWidth: "none" }}>
                <div><strong>Serviço:</strong> {selectedService?.name ?? "—"}</div>
                {selectedProfessional && <div><strong>Profissional:</strong> {selectedProfessional.name}</div>}
                <div><strong>Data:</strong> {form.date ? formatDateLong(form.date) : "—"}</div>
                <div><strong>Horário:</strong> {form.time || "—"}</div>
                <div><strong>Duração:</strong> {selectedService?.durationMinutes ?? "—"} min</div>
                <div><strong>Valor:</strong> {formatMoney(selectedService?.basePrice)}</div>
                <hr style={{ border: 0, borderTop: "1px solid var(--pb-border)", margin: "8px 0" }} />
                <div><strong>Nome:</strong> {form.name}</div>
                <div><strong>Telefone:</strong> {form.phone}</div>
                {form.email && <div><strong>E-mail:</strong> {form.email}</div>}
              </div>

              {settings?.requireManualApproval && (
                <div className="pb-warn" style={{ marginTop: 14 }}>
                  <Clock size={14} />
                  <span>Seu agendamento ficará pendente até ser aprovado pela empresa.</span>
                </div>
              )}
            </section>
          )}

          {/* ─── Navegação ─── */}
          <div className="pb-nav">
            {step > 1 ? (
              <button type="button" className="pb-cta-secondary" onClick={() => setStep(step - 1)}>
                <ChevronLeft size={16} /> Voltar
              </button>
            ) : <span />}

            {step < totalSteps ? (
              <button type="button" className="pb-cta" onClick={goNext} disabled={!canAdvance()}>
                Continuar <ChevronRight size={16} />
              </button>
            ) : (
              <button type="submit" className="pb-cta" disabled={submitting}>
                {submitting ? "Agendando…" : "Confirmar agendamento"}
                {!submitting && <Check size={16} />}
              </button>
            )}
          </div>
        </form>

        {/* ─── Info bar (estática, sem dados sensíveis) ─── */}
        <section className="pb-info" aria-label="Informações">
          <div className="pb-info-card">
            <div className="pb-info-card__ico"><MessageCircle size={16} /></div>
            <div>
              <div className="t">Confirmação rápida</div>
              <div className="s">Você recebe um aviso assim que o agendamento for processado.</div>
            </div>
          </div>
          <div className="pb-info-card">
            <div className="pb-info-card__ico"><Calendar size={16} /></div>
            <div>
              <div className="t">Reagendamento fácil</div>
              <div className="s">Caso precise mudar, entre em contato com a empresa.</div>
            </div>
          </div>
          <div className="pb-info-card">
            <div className="pb-info-card__ico"><Shield size={16} /></div>
            <div>
              <div className="t">Seus dados protegidos</div>
              <div className="s">Tratamos suas informações conforme a LGPD.</div>
            </div>
          </div>
        </section>

        <Footer companyDisplay={companyDisplay} />
      </div>
    </div>
  );
}

/* ─── Subcomponentes locais ─── */

function Header({
  companyDisplay,
  initials,
  phone,
  businessHours
}: {
  companyDisplay: string;
  initials: string;
  phone: string | null;
  businessHours?: Record<string, { open: boolean; from?: string; to?: string }> | null;
}) {
  const today = new Date().getDay();
  const dayKeys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const todayHours = businessHours?.[dayKeys[today]];
  const isOpen = todayHours?.open && todayHours.from && todayHours.to;
  const waNumber = phone?.replace(/\D/g, "");
  const waLink = waNumber ? `https://wa.me/55${waNumber.startsWith("55") ? waNumber.slice(2) : waNumber}` : null;

  return (
    <header className="pb-head">
      <div className="pb-brand">
        <span className="pb-brand__logo">{initials}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="pb-brand__name">{companyDisplay}</div>
          <div className="pb-brand__slogan" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: isOpen ? "#16a34a" : "#94a3b8", display: "inline-block" }} />
              {isOpen ? `Aberto agora · ${todayHours.from}–${todayHours.to}` : "Fechado agora"}
            </span>
            {phone ? <span style={{ color: "rgba(255,255,255,0.7)" }}>· {phone}</span> : null}
          </div>
        </div>
        {waLink ? (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Falar no WhatsApp"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 14px", borderRadius: 999,
              background: "#25d366", color: "#fff",
              fontSize: 13, fontWeight: 600,
              textDecoration: "none",
              boxShadow: "0 2px 8px rgba(37,211,102,0.3)"
            }}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24z"/></svg>
            WhatsApp
          </a>
        ) : null}
      </div>
    </header>
  );
}

function Footer({ companyDisplay }: { companyDisplay: string }) {
  return (
    <footer className="pb-footer">
      {companyDisplay}
      <br />
      <span className="pb-powered">
        <span className="m">M</span>
        Powered by <strong>MarcaiFlex</strong>
      </span>
    </footer>
  );
}

function Stepper({ labels, current }: { labels: string[]; current: number }) {
  return (
    <nav className="pb-stepper" aria-label="Etapas do agendamento">
      <div className="pb-stepper__list">
        {labels.map((label, i) => {
          const num = i + 1;
          const done = num < current;
          const on = num === current;
          return (
            <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
              {i > 0 && <span className="pb-step__sep">›</span>}
              <span className={`pb-step ${done ? "is-done" : ""} ${on ? "is-on" : ""}`}>
                <span className="pb-step__num">{done ? <Check size={11} /> : num}</span>
                {label}
              </span>
            </span>
          );
        })}
      </div>
    </nav>
  );
}

function SlotGrid({
  groups,
  selectedTime,
  onSelect
}: {
  groups: { morning: Slot[]; afternoon: Slot[]; evening: Slot[] };
  selectedTime: string;
  onSelect: (slot: Slot) => void;
}) {
  const sections: { label: string; icon: React.ReactNode; slots: Slot[] }[] = [
    { label: "Manhã", icon: <Sun size={13} />, slots: groups.morning },
    { label: "Tarde", icon: <Sunset size={13} />, slots: groups.afternoon },
    { label: "Noite", icon: <Moon size={13} />, slots: groups.evening }
  ];

  return (
    <>
      {sections.map((sec) =>
        sec.slots.length === 0 ? null : (
          <div className="pb-slot-group" key={sec.label}>
            <div className="pb-slot-group__lbl">{sec.icon}{sec.label}</div>
            <div className="pb-slots">
              {sec.slots.map((slot) => (
                <button
                  type="button"
                  key={slot.time}
                  className={`pb-slot ${selectedTime === slot.time ? "is-on" : ""} ${!slot.available ? "is-off" : ""}`}
                  onClick={() => onSelect(slot)}
                  disabled={!slot.available}
                  aria-label={`Horário ${slot.time}${slot.available ? "" : " indisponível"}`}
                >
                  {slot.time}
                </button>
              ))}
            </div>
          </div>
        )
      )}
    </>
  );
}
