"use client";

import { Check } from "lucide-react";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { maskPhone, isValidPhone } from "@/lib/utils/masks";
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

/** Aplica a cor de marca da empresa no widget via --ac / --ac-h. */
function brandPalette(primary: string): React.CSSProperties {
  return {
    ["--ac" as never]: primary,
    ["--ac-h" as never]: shadeHex(primary, -24)
  };
}

const DOW_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTH_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const PERIODS = ["morning", "afternoon", "evening"] as const;
const PERIOD_LABEL: Record<(typeof PERIODS)[number], string> = {
  morning: "Manhã",
  afternoon: "Tarde",
  evening: "Noite"
};

const PAYMENT_OPTIONS: { value: string; label: string; icon: string }[] = [
  { value: "PIX", label: "Pix", icon: "◈" },
  { value: "CREDIT_CARD", label: "Cartão crédito", icon: "💳" },
  { value: "DEBIT_CARD", label: "Cartão débito", icon: "💳" },
  { value: "CASH", label: "Dinheiro", icon: "💵" },
  { value: "TRANSFER", label: "Transferência", icon: "🏦" },
  { value: "OTHER", label: "Outro", icon: "•••" }
];

const PAYMENT_LABELS: Record<string, string> = {
  PIX: "Pix",
  CREDIT_CARD: "Cartão de crédito",
  DEBIT_CARD: "Cartão de débito",
  CASH: "Dinheiro",
  BOLETO: "Boleto",
  TRANSFER: "Transferência",
  OTHER: "Outro"
};

function bizMonogram(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0] ?? "")
      .join("")
      .toUpperCase() || "MF"
  );
}

/** Cor determinística para o avatar do profissional (hue derivado do id). */
function avatarColor(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 42% 46%)`;
}

function formatMoney(v?: string | number | null) {
  if (v === null || v === undefined || v === "") return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));
}

function formatDateLong(dateStr: string) {
  const d = new Date(`${dateStr}T12:00:00`);
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(d);
}

function formatDateShort(dateStr: string) {
  const d = new Date(`${dateStr}T12:00:00`);
  return `${d.getDate()}/${MONTH_SHORT[d.getMonth()]}`;
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

function emptyForm() {
  return {
    name: "",
    phone: "",
    email: "",
    notes: "",
    cpf: "",
    serviceIds: [] as string[],
    professionalId: "",
    date: "",
    time: "",
    startAt: "",
    endAt: "",
    paymentMethod: "",
    lgpdAccepted: false,
    healthInsurance: "",
    healthInsuranceNumber: "",
    allergies: "",
    requiredCare: ""
  };
}

type BookingForm = ReturnType<typeof emptyForm>;

export default function PublicBookingClient() {
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

  const [form, setForm] = useState<BookingForm>(emptyForm);

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

  const selectedServices = useMemo(
    () => services.filter((s) => form.serviceIds.includes(s.id)),
    [form.serviceIds, services]
  );
  const totalDuration = useMemo(
    () => selectedServices.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0),
    [selectedServices]
  );
  const totalPrice = useMemo(
    () => selectedServices.reduce((sum, s) => sum + Number(s.basePrice ?? 0), 0),
    [selectedServices]
  );
  const selectedProfessional = useMemo(
    () => professionals.find((p) => p.id === form.professionalId),
    [form.professionalId, professionals]
  );

  const serviceIdsKey = form.serviceIds.join(",");

  useEffect(() => {
    if (!form.date || !serviceIdsKey || !form.professionalId) {
      setSlots([]);
      return;
    }
    setLoadingSlots(true);
    setError("");
    fetch(`/api/public/${slug}/slots?date=${form.date}&serviceIds=${serviceIdsKey}&professionalId=${form.professionalId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Erro ao carregar horários.");
        return r.json();
      })
      .then((data) => setSlots(data.slots ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoadingSlots(false));
  }, [form.date, serviceIdsKey, form.professionalId, slug]);

  function selectSlot(slot: Slot) {
    if (!slot.available) return;
    setForm((f) => ({ ...f, time: slot.time, startAt: slot.startAt, endAt: slot.endAt }));
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
      case 1:
        return form.serviceIds.length > 0;
      case 2:
        return !!form.professionalId && !!form.date && !!form.startAt;
      case 3:
        return (
          !!form.name.trim() &&
          isValidPhone(form.phone) &&
          !!form.email &&
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) &&
          form.lgpdAccepted
        );
      case 4:
        return true; // health step ou confirmação
      default:
        return true;
    }
  }

  function goNext() {
    if (step === 2 && settings?.allowChooseProfessional === false && professionals.length > 0 && !form.professionalId) {
      setForm({ ...form, professionalId: professionals[0].id });
    }
    setStep(step + 1);
  }

  function resetForm() {
    setSuccess(null);
    setStep(1);
    setSlots([]);
    setError("");
    setForm(emptyForm());
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    // Em etapas intermediárias (ex.: Enter num input), apenas avança — nunca
    // envia o agendamento antes da etapa final.
    if (step < totalSteps) {
      if (canAdvance()) goNext();
      return;
    }
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

  // ─── Loading ───────────────────────────────────────────────
  if (loading) {
    return (
      <Shell>
        <div className="sr-main">
          <div className="sr-body" style={{ paddingTop: 28 }}>
            <div className="sr-skel" style={{ width: "55%", height: 18, marginBottom: 20 }} />
            <div className="sr-skel" style={{ marginBottom: 12 }} />
            <div className="sr-skel" style={{ marginBottom: 12, width: "85%" }} />
            <div className="sr-skel" style={{ width: "45%" }} />
          </div>
        </div>
      </Shell>
    );
  }

  // ─── Erro fatal (empresa não encontrada) ───────────────────
  if (error && !company) {
    return (
      <Shell>
        <div className="sr-main">
          <div className="sr-error">{error}</div>
        </div>
      </Shell>
    );
  }

  const companyDisplay = company?.tradeName || company?.name || "Empresa";
  const monogram = bizMonogram(companyDisplay);
  const brandStyle = settings?.primaryColor ? brandPalette(settings.primaryColor) : undefined;

  // Status aberto/fechado (dado real de businessHours).
  const dayKeys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const todayHours = company?.businessHours?.[dayKeys[new Date().getDay()]];
  const isOpen = !!(todayHours?.open && todayHours.from && todayHours.to);
  const statusText = isOpen ? `Aberto agora · ${todayHours!.from}–${todayHours!.to}` : "Fechado agora";

  // ─── Sucesso ───────────────────────────────────────────────
  if (success) {
    return (
      <Shell style={brandStyle}>
        <div className="sr-main">
          <div className="sr-done">
            <div className="sr-check"><Check size={36} /></div>
            <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.02em", margin: 0 }}>
              Agendamento confirmado!
            </h2>
            <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 10, lineHeight: 1.55, maxWidth: 320 }}>
              {success}
            </p>
            {selectedServices.length > 0 && (
              <div className="sr-sumcard" style={{ marginTop: 22, width: "100%", maxWidth: 340, textAlign: "left" }}>
                <div className="sr-sumrow">
                  <span className="k">{selectedServices.length > 1 ? "Serviços" : "Serviço"}</span>
                  <span className="v">{selectedServices.map((s) => s.name).join(", ")}</span>
                </div>
                {selectedProfessional && (
                  <div className="sr-sumrow"><span className="k">Profissional</span><span className="v">{selectedProfessional.name}</span></div>
                )}
                <div className="sr-sumrow"><span className="k">Data</span><span className="v">{form.date ? formatDateLong(form.date) : "—"}</span></div>
                <div className="sr-sumrow"><span className="k">Horário</span><span className="v">{form.time || "—"}</span></div>
              </div>
            )}
            <div className="sr-wa">✓ Horário reservado com sucesso</div>
            <button type="button" className="sr-cta" style={{ marginTop: 28, background: "var(--text)" }} onClick={resetForm}>
              Novo agendamento
            </button>
            <div style={{ marginTop: 24 }}><MFBadge /></div>
          </div>
        </div>
      </Shell>
    );
  }

  // ─── Fluxo principal ───────────────────────────────────────
  const pct = Math.round((step / totalSteps) * 100);
  const showProSelector = settings?.allowChooseProfessional !== false;

  function railValue(n: number): string | null {
    if (n === 1) return selectedServices.length ? selectedServices.map((s) => s.name).join(", ") : null;
    if (n === 2) {
      const parts: string[] = [];
      if (form.date) parts.push(formatDateShort(form.date));
      if (form.time) parts.push(form.time);
      return parts.length ? parts.join(" · ") : null;
    }
    if (n === 3) return form.name ? form.name.split(" ")[0] : null;
    return null;
  }

  function stepHint(): string {
    if (step === 1) return "Selecione o serviço que deseja agendar.";
    if (step === 2) return "Escolha o profissional, a data e o melhor horário.";
    if (step === 3) return "Precisamos de alguns dados para confirmar.";
    if (step === 4 && company?.isHealthSegment) return "Informações de saúde (opcionais) para o atendimento.";
    return "Revise tudo antes de confirmar o agendamento.";
  }

  const ctaLabel = submitting ? "Agendando…" : "Confirmar";

  return (
    <Shell style={brandStyle}>
      {/* ─── RAIL (desktop) ─── */}
      <aside className="sr-rail">
        <div className="sr-mono sr-railmono">{monogram}</div>
        <div className="sr-railname">{companyDisplay}</div>
        <div className="sr-railsub">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: 99, background: isOpen ? "#16a34a" : "var(--muted-2)", display: "inline-block" }} />
            {statusText}
          </span>
          {company?.phone ? <><br />{company.phone}</> : null}
        </div>
        <div className="sr-raildiv" />
        <div className="sr-railsteps">
          {stepLabels.map((label, i) => {
            const n = i + 1;
            const cur = n === step;
            const past = n < step;
            const value = past ? railValue(n) : null;
            return (
              <div key={label} className={`sr-railstep${cur ? " cur" : past ? " past" : ""}`}>
                <span className="n">{past ? <Check size={12} /> : n}</span>
                {label}
                {value ? <span className="v">{value}</span> : null}
              </div>
            );
          })}
        </div>
        <div className="sr-railfoot"><MFBadge /></div>
      </aside>

      {/* ─── MAIN ─── */}
      <form className="sr-main" onSubmit={submit}>
        {/* Topbar (mobile) */}
        <div className="sr-top">
          <div className="sr-mono">{monogram}</div>
          <div style={{ minWidth: 0 }}>
            <div className="sr-bizname">{companyDisplay}</div>
            <div className="sr-bizsub">
              <span style={{ width: 6, height: 6, borderRadius: 99, background: isOpen ? "#16a34a" : "var(--muted-2)", display: "inline-block" }} />
              {statusText}
            </div>
          </div>
        </div>

        {/* Progresso */}
        <div className="sr-prog">
          <div className="sr-progbar">
            <div className="sr-progfill" style={{ width: `${pct}%` }} />
          </div>
          <div className="sr-progmeta">
            <span className="sr-steplabel">{stepLabels[step - 1]}</span>
            <span className="sr-stepcount">Etapa {step} de {totalSteps}</span>
          </div>
        </div>

        {/* Corpo */}
        <div className="sr-body">
          <p className="sr-hint">{stepHint()}</p>
          {error ? <p className="sr-hint" style={{ color: "var(--danger)" }}>{error}</p> : null}

          {/* Step 1 — Serviço */}
          {step === 1 && (
            <>
              {settings?.instructions ? <p className="sr-hint">{settings.instructions}</p> : null}
              <div className="sr-list">
                {services.length === 0 && <p className="sr-hint">Nenhum serviço disponível no momento.</p>}
                {services.map((s) => {
                  const on = form.serviceIds.includes(s.id);
                  return (
                    <button
                      type="button"
                      key={s.id}
                      className={`sr-row${on ? " on" : ""}`}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          serviceIds: on ? f.serviceIds.filter((id) => id !== s.id) : [...f.serviceIds, s.id],
                          time: "",
                          startAt: "",
                          endAt: ""
                        }))
                      }
                    >
                      <span className="sr-radio">{on && <Check size={13} />}</span>
                      <div className="sr-rowmain">
                        <div className="sr-rowname">{s.name}</div>
                        {s.description && <div className="sr-rowdesc">{s.description}</div>}
                        <div className="sr-rowmeta">{s.durationMinutes} min</div>
                      </div>
                      <div className="sr-rowright">
                        <div className="sr-price">{formatMoney(s.basePrice)}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Step 2 — Profissional + data + horário */}
          {step === 2 && (
            <>
              {showProSelector && (
                <>
                  <div className="sr-perlabel">Profissional</div>
                  <div className="sr-list" style={{ marginBottom: 20 }}>
                    {professionals.length === 0 && <p className="sr-hint">Nenhum profissional disponível.</p>}
                    {professionals.map((p) => {
                      const on = form.professionalId === p.id;
                      const initials = bizMonogram(p.name);
                      return (
                        <button
                          type="button"
                          key={p.id}
                          className={`sr-row${on ? " on" : ""}`}
                          onClick={() => setForm((f) => ({ ...f, professionalId: p.id, date: "", time: "", startAt: "", endAt: "" }))}
                        >
                          <span className="sr-av" style={{ background: avatarColor(p.id) }}>{initials}</span>
                          <div className="sr-rowmain">
                            <div className="sr-rowname">{p.name}</div>
                            {p.specialty && <div className="sr-rowdesc">{p.specialty}</div>}
                          </div>
                          <span className="sr-radio">{on && <Check size={13} />}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              <div className="sr-perlabel">Data</div>
              <div className="sr-datechips">
                {dateChips.map((c) => (
                  <button
                    type="button"
                    key={c.value}
                    className={`sr-datechip${form.date === c.value ? " on" : ""}`}
                    onClick={() => setForm((f) => ({ ...f, date: c.value, time: "", startAt: "", endAt: "" }))}
                  >
                    <span className="dow">{c.dow}</span>
                    <span className="num">{c.num}</span>
                    <span className="mon">{c.mon}</span>
                  </button>
                ))}
              </div>

              {!form.professionalId ? (
                <p className="sr-hint">Selecione um profissional para ver os horários.</p>
              ) : form.date ? (
                loadingSlots ? (
                  <p className="sr-hint">Carregando horários…</p>
                ) : slots.length === 0 ? (
                  <p className="sr-hint">Não há horários disponíveis nesse dia. Escolha outra data.</p>
                ) : (
                  PERIODS.map((period) => {
                    const arr = groupedSlots[period];
                    if (!arr.length) return null;
                    return (
                      <div className="sr-period" key={period}>
                        <div className="sr-perlabel">{PERIOD_LABEL[period]}</div>
                        <div className="sr-slots">
                          {arr.map((s) => (
                            <button
                              type="button"
                              key={s.time}
                              className={`sr-slot${form.time === s.time ? " on" : ""}`}
                              disabled={!s.available}
                              onClick={() => selectSlot(s)}
                            >
                              {s.time}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )
              ) : null}
            </>
          )}

          {/* Step 3 — Seus dados */}
          {step === 3 && (
            <>
              <div className="sr-field">
                <label className="sr-lab" htmlFor="sr-name">Nome completo *</label>
                <input
                  id="sr-name"
                  className="sr-input"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Seu nome completo"
                  autoComplete="name"
                />
              </div>
              <div className="sr-field">
                <label className="sr-lab" htmlFor="sr-phone">Telefone/WhatsApp *</label>
                <input
                  id="sr-phone"
                  className="sr-input"
                  required
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: maskPhone(e.target.value) }))}
                  placeholder="(11) 99999-9999"
                  autoComplete="tel"
                  inputMode="numeric"
                />
              </div>
              <div className="sr-field">
                <label className="sr-lab" htmlFor="sr-email">E-mail *</label>
                <input
                  id="sr-email"
                  className="sr-input"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="seu@email.com"
                  autoComplete="email"
                  inputMode="email"
                />
              </div>
              <div className="sr-field">
                <label className="sr-lab" htmlFor="sr-notes">Observações</label>
                <textarea
                  id="sr-notes"
                  className="sr-input"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Informações adicionais (opcional)"
                />
              </div>

              <div className="sr-field">
                <label className="sr-lab">Como prefere pagar? <span style={{ color: "var(--muted)", fontWeight: 400 }}>(opcional)</span></label>
                <div className="sr-chips">
                  {PAYMENT_OPTIONS.map((opt) => (
                    <button
                      type="button"
                      key={opt.value}
                      className={`sr-chip${form.paymentMethod === opt.value ? " on" : ""}`}
                      onClick={() => setForm((f) => ({ ...f, paymentMethod: f.paymentMethod === opt.value ? "" : opt.value }))}
                    >
                      {opt.icon} {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="sr-consent">
                <input
                  type="checkbox"
                  checked={form.lgpdAccepted}
                  onChange={(e) => setForm((f) => ({ ...f, lgpdAccepted: e.target.checked }))}
                />
                <span>
                  <strong>LGPD:</strong> Aceito a coleta e processamento dos meus dados pessoais conforme a política
                  de privacidade e a Lei Geral de Proteção de Dados.
                </span>
              </label>
            </>
          )}

          {/* Step 4 — Saúde (segmento de saúde) */}
          {step === 4 && company?.isHealthSegment && (
            <>
              <div className="sr-field">
                <label className="sr-lab" htmlFor="sr-ins">Convênio</label>
                <input
                  id="sr-ins"
                  className="sr-input"
                  value={form.healthInsurance}
                  onChange={(e) => setForm((f) => ({ ...f, healthInsurance: e.target.value }))}
                  placeholder="Nome do convênio"
                />
              </div>
              <div className="sr-field">
                <label className="sr-lab" htmlFor="sr-insn">Nº da carteirinha</label>
                <input
                  id="sr-insn"
                  className="sr-input"
                  value={form.healthInsuranceNumber}
                  onChange={(e) => setForm((f) => ({ ...f, healthInsuranceNumber: e.target.value }))}
                  placeholder="Número"
                />
              </div>
              <div className="sr-field">
                <label className="sr-lab" htmlFor="sr-alg">Alergias</label>
                <textarea
                  id="sr-alg"
                  className="sr-input"
                  value={form.allergies}
                  onChange={(e) => setForm((f) => ({ ...f, allergies: e.target.value }))}
                  placeholder="Alergias conhecidas (opcional)"
                />
              </div>
              <div className="sr-field">
                <label className="sr-lab" htmlFor="sr-care">Cuidados necessários</label>
                <textarea
                  id="sr-care"
                  className="sr-input"
                  value={form.requiredCare}
                  onChange={(e) => setForm((f) => ({ ...f, requiredCare: e.target.value }))}
                  placeholder="Cuidados especiais (opcional)"
                />
              </div>
            </>
          )}

          {/* Step final — Confirmação */}
          {step === totalSteps && (
            <>
              <div className="sr-sumcard">
                <div className="sr-sumrow">
                  <span className="k">{selectedServices.length > 1 ? "Serviços" : "Serviço"}</span>
                  <span className="v">{selectedServices.length > 0 ? selectedServices.map((s) => s.name).join(", ") : "—"}</span>
                </div>
                {selectedProfessional && (
                  <div className="sr-sumrow"><span className="k">Profissional</span><span className="v">{selectedProfessional.name}</span></div>
                )}
                <div className="sr-sumrow"><span className="k">Data</span><span className="v">{form.date ? formatDateLong(form.date) : "—"}</span></div>
                <div className="sr-sumrow"><span className="k">Horário</span><span className="v">{form.time || "—"}</span></div>
                <div className="sr-sumrow"><span className="k">Duração</span><span className="v">{totalDuration || "—"} min</span></div>
                <div className="sr-sumrow"><span className="k">Valor</span><span className="v">{formatMoney(totalPrice)}</span></div>
                {form.paymentMethod && (
                  <div className="sr-sumrow"><span className="k">Pagamento</span><span className="v">💳 {PAYMENT_LABELS[form.paymentMethod] ?? form.paymentMethod}</span></div>
                )}
              </div>
              <div className="sr-sumcard">
                <div className="sr-sumrow"><span className="k">Nome</span><span className="v">{form.name || "—"}</span></div>
                <div className="sr-sumrow"><span className="k">Telefone</span><span className="v">{form.phone || "—"}</span></div>
                {form.email && <div className="sr-sumrow"><span className="k">E-mail</span><span className="v">{form.email}</span></div>}
              </div>
              {settings?.requireManualApproval && (
                <p className="sr-hint">Seu agendamento ficará pendente até ser aprovado pela empresa.</p>
              )}
            </>
          )}
        </div>

        {/* Footer fixo */}
        <div className="sr-foot">
          {step > 1 ? (
            <button type="button" className="sr-back" onClick={() => setStep(step - 1)}>← Voltar</button>
          ) : null}
          <div className="sr-footsum">
            {selectedServices.length > 0 ? (
              <>
                <div className="a">{selectedServices.map((s) => s.name).join(" + ")}</div>
                <div className="b">
                  {totalPrice > 0 ? formatMoney(totalPrice) : ""}
                  {totalDuration ? ` · ${totalDuration} min` : ""}
                </div>
              </>
            ) : null}
          </div>
          {step < totalSteps ? (
            <button type="button" className="sr-cta" disabled={!canAdvance()} onClick={goNext}>
              Continuar →
            </button>
          ) : (
            <button type="submit" className="sr-cta" disabled={submitting}>
              {ctaLabel} {!submitting ? "→" : null}
            </button>
          )}
        </div>
      </form>
    </Shell>
  );
}

/* ─── Subcomponentes locais ─── */

function Shell({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="sr-page">
      <div className="sr-frame">
        <div className="sr" style={style}>{children}</div>
      </div>
    </div>
  );
}

function MFBadge() {
  return (
    <div className="sr-mfbadge">
      <span>Agendado com</span>
      <span className="sr-mfbadge__icon">MF</span>
      <span className="sr-mfbadge__name">MarcaiFlex</span>
    </div>
  );
}
