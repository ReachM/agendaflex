"use client";

import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock, Shield, User } from "lucide-react";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

type CompanyInfo = { name: string; tradeName: string; segment: string; isHealthSegment: boolean };
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
};

function formatMoney(v?: string | number | null) {
  if (v === null || v === undefined || v === "") return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));
}

function formatDateBR(dateStr: string) {
  const d = new Date(`${dateStr}T12:00:00`);
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(d);
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

  // Slots
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [form, setForm] = useState({
    name: "", phone: "", email: "", notes: "", cpf: "",
    serviceId: "", professionalId: "", date: "", time: "",
    startAt: "", endAt: "",
    lgpdAccepted: false,
    // Health fields
    healthInsurance: "", healthInsuranceNumber: "",
    allergies: "", requiredCare: ""
  });

  useEffect(() => {
    fetch(`/api/public/${slug}/book`)
      .then(async r => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Página não encontrada.");
        return r.json();
      })
      .then(data => {
        setCompany(data.company);
        setServices(data.services);
        setProfessionals(data.professionals);
        setSettings(data.settings);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug]);

  const selectedService = useMemo(() => services.find(s => s.id === form.serviceId), [form.serviceId, services]);

  // Load slots when date, service and professional are selected
  useEffect(() => {
    if (!form.date || !form.serviceId || !form.professionalId) {
      setSlots([]);
      return;
    }
    setLoadingSlots(true);
    setError("");
    fetch(`/api/public/${slug}/slots?date=${form.date}&serviceId=${form.serviceId}&professionalId=${form.professionalId}`)
      .then(async r => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Erro ao carregar horários.");
        return r.json();
      })
      .then(data => setSlots(data.slots ?? []))
      .catch(err => setError(err.message))
      .finally(() => setLoadingSlots(false));
  }, [form.date, form.serviceId, form.professionalId, slug]);

  function selectSlot(slot: Slot) {
    setForm({ ...form, time: slot.time, startAt: slot.startAt, endAt: slot.endAt });
  }

  const minDate = new Date().toISOString().slice(0, 10);
  const maxDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + (settings?.maxDaysAhead ?? 30));
    return d.toISOString().slice(0, 10);
  }, [settings]);

  const totalSteps = company?.isHealthSegment ? 5 : 4;

  function canAdvance(): boolean {
    switch (step) {
      case 1: return !!form.serviceId;
      case 2: return !!form.professionalId && !!form.date && !!form.startAt;
      case 3: return !!form.name && !!form.phone && form.lgpdAccepted;
      default: return true;
    }
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

  if (loading) {
    return (
      <div className="public-booking">
        <div className="public-booking__card" style={{ padding: 60, textAlign: "center" }}>
          <div className="loading-spinner" style={{ margin: "0 auto" }} />
        </div>
      </div>
    );
  }

  if (error && !company) {
    return (
      <div className="public-booking">
        <div className="public-booking__card" style={{ padding: 60, textAlign: "center" }}>
          <p style={{ color: "var(--danger)", fontWeight: 600 }}>{error}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="public-booking">
        <div className="public-booking__card">
          <div className="public-booking__header">
            <h1>{company?.tradeName ?? company?.name}</h1>
            <p>Agendamento online</p>
          </div>
          <div className="public-booking__success">
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg, #22c55e, #16a34a)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
              <Check size={32} color="#fff" />
            </div>
            <h2 style={{ marginTop: 16 }}>Agendamento Realizado!</h2>
            <p style={{ color: "var(--muted)", marginTop: 8 }}>{success}</p>
            {selectedService && (
              <div style={{ marginTop: 20, padding: "16px", background: "var(--surface-alt)", borderRadius: "var(--radius)", textAlign: "left", fontSize: 14 }}>
                <div><strong>Serviço:</strong> {selectedService.name}</div>
                <div><strong>Data:</strong> {form.date ? formatDateBR(form.date) : "-"}</div>
                <div><strong>Horário:</strong> {form.time}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="public-booking">
      <div className="public-booking__card" style={{ maxWidth: 640 }}>
        <div className="public-booking__header">
          <h1>{company?.tradeName ?? company?.name}</h1>
          <p>Agende seu atendimento de forma rápida e prática</p>
        </div>

        {/* Step indicator */}
        <div style={{ display: "flex", gap: 4, padding: "0 24px", marginBottom: 8 }}>
          {Array.from({ length: totalSteps }, (_, i) => (
            <div key={i} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: i + 1 <= step ? "var(--primary)" : "var(--border)",
              transition: "background 0.3s"
            }} />
          ))}
        </div>

        {settings?.instructions && step === 1 && (
          <div style={{ padding: "8px 24px", fontSize: 13, color: "var(--muted)", fontStyle: "italic" }}>
            {settings.instructions}
          </div>
        )}

        <div className="public-booking__body">
          {error && <div className="error-box">{error}</div>}

          <form onSubmit={submit}>
            {/* STEP 1: Service selection */}
            {step === 1 && (
              <div>
                <h3 style={{ marginBottom: 12, fontSize: 16 }}>
                  <Clock size={16} style={{ verticalAlign: -3 }} /> Escolha o serviço
                </h3>
                <div style={{ display: "grid", gap: 8 }}>
                  {services.map(s => (
                    <div
                      key={s.id}
                      onClick={() => setForm({ ...form, serviceId: s.id })}
                      style={{
                        padding: "14px 16px", borderRadius: "var(--radius)", cursor: "pointer",
                        border: form.serviceId === s.id ? "2px solid var(--primary)" : "1px solid var(--border)",
                        background: form.serviceId === s.id ? "var(--surface-alt)" : "var(--surface)",
                        transition: "all 0.2s"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <strong>{s.name}</strong>
                        <span style={{ color: "var(--primary)", fontWeight: 600 }}>{formatMoney(s.basePrice)}</span>
                      </div>
                      {s.description && <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>{s.description}</div>}
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{s.durationMinutes} min</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 2: Professional, date, time */}
            {step === 2 && (
              <div>
                <h3 style={{ marginBottom: 12, fontSize: 16 }}>
                  <CalendarDays size={16} style={{ verticalAlign: -3 }} /> Escolha o horário
                </h3>

                {settings?.allowChooseProfessional !== false && (
                  <div className="field" style={{ marginBottom: 16 }}>
                    <label>Profissional</label>
                    <select value={form.professionalId} onChange={e => setForm({ ...form, professionalId: e.target.value, date: "", time: "", startAt: "", endAt: "" })}>
                      <option value="">Selecione o profissional</option>
                      {professionals.map(p => <option key={p.id} value={p.id}>{p.name}{p.specialty ? ` — ${p.specialty}` : ""}</option>)}
                    </select>
                  </div>
                )}

                <div className="field" style={{ marginBottom: 16 }}>
                  <label>Data</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value, time: "", startAt: "", endAt: "" })}
                    min={minDate}
                    max={maxDate}
                  />
                  {form.date && <small style={{ color: "var(--muted)", marginTop: 4, display: "block" }}>{formatDateBR(form.date)}</small>}
                </div>

                {/* Time slots */}
                {form.date && form.professionalId && (
                  <div>
                    <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>Horários disponíveis</label>
                    {loadingSlots ? (
                      <div style={{ textAlign: "center", padding: 20 }}>
                        <div className="loading-spinner" style={{ margin: "0 auto", width: 24, height: 24 }} />
                      </div>
                    ) : slots.length === 0 ? (
                      <div style={{ padding: "16px", textAlign: "center", color: "var(--muted)", background: "var(--surface-alt)", borderRadius: "var(--radius)" }}>
                        Não há horários disponíveis para esse dia.
                      </div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 6 }}>
                        {slots.map(slot => (
                          <button
                            key={slot.time}
                            type="button"
                            onClick={() => selectSlot(slot)}
                            style={{
                              padding: "10px 8px", borderRadius: "var(--radius)", fontSize: 14, fontWeight: 500,
                              border: form.time === slot.time ? "2px solid var(--primary)" : "1px solid var(--border)",
                              background: form.time === slot.time ? "var(--primary)" : "var(--surface)",
                              color: form.time === slot.time ? "#fff" : "var(--text)",
                              cursor: "pointer", transition: "all 0.2s"
                            }}
                          >
                            {slot.time}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: Personal data */}
            {step === 3 && (
              <div>
                <h3 style={{ marginBottom: 12, fontSize: 16 }}>
                  <User size={16} style={{ verticalAlign: -3 }} /> Seus dados
                </h3>
                <div className="form-grid">
                  <div className="field"><label>Nome completo *</label><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Seu nome completo" /></div>
                  <div className="field"><label>Telefone/WhatsApp *</label><input required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="(00) 00000-0000" /></div>
                  <div className="field"><label>E-mail</label><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="seu@email.com" /></div>
                  <div className="field"><label>CPF</label><input value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} placeholder="000.000.000-00" /></div>
                  <div className="field full"><label>Observações</label><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Informações adicionais (opcional)" /></div>
                  <div className="field full">
                    <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer", fontSize: 13, color: "var(--text-secondary)" }}>
                      <input
                        type="checkbox"
                        checked={form.lgpdAccepted}
                        onChange={e => setForm({ ...form, lgpdAccepted: e.target.checked })}
                        style={{ marginTop: 2, width: 16, height: 16 }}
                      />
                      <span>
                        <Shield size={14} style={{ verticalAlign: -2 }} /> Aceito a coleta e processamento dos meus dados pessoais conforme a política de privacidade e a Lei Geral de Proteção de Dados (LGPD). *
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4 (Health): Additional clinic fields */}
            {step === 4 && company?.isHealthSegment && (
              <div>
                <h3 style={{ marginBottom: 12, fontSize: 16 }}>Informações adicionais (saúde)</h3>
                <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>Campos opcionais para facilitar seu atendimento.</p>
                <div className="form-grid">
                  <div className="field"><label>Convênio</label><input value={form.healthInsurance} onChange={e => setForm({ ...form, healthInsurance: e.target.value })} placeholder="Nome do convênio" /></div>
                  <div className="field"><label>Nº da carteirinha</label><input value={form.healthInsuranceNumber} onChange={e => setForm({ ...form, healthInsuranceNumber: e.target.value })} placeholder="Número" /></div>
                  <div className="field full"><label>Alergias</label><textarea value={form.allergies} onChange={e => setForm({ ...form, allergies: e.target.value })} placeholder="Alergias conhecidas (opcional)" /></div>
                  <div className="field full"><label>Cuidados necessários</label><textarea value={form.requiredCare} onChange={e => setForm({ ...form, requiredCare: e.target.value })} placeholder="Cuidados especiais (opcional)" /></div>
                </div>
              </div>
            )}

            {/* STEP 4/5: Confirmation */}
            {step === totalSteps && (
              <div>
                <h3 style={{ marginBottom: 12, fontSize: 16 }}>
                  <Check size={16} style={{ verticalAlign: -3 }} /> Confirmar agendamento
                </h3>
                <div style={{ background: "var(--surface-alt)", borderRadius: "var(--radius)", padding: "16px", marginBottom: 16, fontSize: 14 }}>
                  <div style={{ display: "grid", gap: 6 }}>
                    <div><strong>Serviço:</strong> {selectedService?.name ?? "-"}</div>
                    <div><strong>Profissional:</strong> {professionals.find(p => p.id === form.professionalId)?.name ?? "-"}</div>
                    <div><strong>Data:</strong> {form.date ? formatDateBR(form.date) : "-"}</div>
                    <div><strong>Horário:</strong> {form.time || "-"}</div>
                    <div><strong>Duração:</strong> {selectedService?.durationMinutes ?? "-"} min</div>
                    <div><strong>Valor:</strong> {formatMoney(selectedService?.basePrice)}</div>
                    <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "8px 0" }} />
                    <div><strong>Nome:</strong> {form.name}</div>
                    <div><strong>Telefone:</strong> {form.phone}</div>
                    {form.email && <div><strong>E-mail:</strong> {form.email}</div>}
                  </div>
                </div>
                {settings?.requireManualApproval && (
                  <div style={{ padding: "10px 14px", background: "#fef3c7", color: "#92400e", borderRadius: "var(--radius)", fontSize: 13, marginBottom: 16 }}>
                    ⏳ Seu agendamento ficará pendente até ser aprovado pela empresa.
                  </div>
                )}
              </div>
            )}

            {/* Navigation buttons */}
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 24, padding: "0" }}>
              {step > 1 && (
                <button className="button secondary" type="button" onClick={() => setStep(step - 1)} style={{ flex: 1 }}>
                  <ChevronLeft size={16} /> Voltar
                </button>
              )}
              {step < totalSteps ? (
                <button
                  className="button"
                  type="button"
                  onClick={() => {
                    if (step === 2 && !settings?.allowChooseProfessional && professionals.length > 0 && !form.professionalId) {
                      setForm({ ...form, professionalId: professionals[0].id });
                    }
                    setStep(step + 1);
                  }}
                  disabled={!canAdvance()}
                  style={{ flex: step > 1 ? 1 : "auto", marginLeft: step === 1 ? "auto" : 0, minWidth: 160 }}
                >
                  Próximo <ChevronRight size={16} />
                </button>
              ) : (
                <button className="button" type="submit" disabled={submitting} style={{ flex: 1, minHeight: 48, fontSize: 15 }}>
                  {submitting ? "Agendando..." : "Confirmar Agendamento"}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
