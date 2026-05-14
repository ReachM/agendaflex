"use client";

import { CalendarDays, Check, Clock, DollarSign, User } from "lucide-react";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

type CompanyInfo = { name: string; tradeName: string; segment: string };
type Service = { id: string; name: string; description: string; basePrice: string; durationMinutes: number };
type Professional = { id: string; name: string; specialty: string };

function formatMoney(v?: string | number | null) {
  if (v === null || v === undefined || v === "") return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));
}

export default function PublicBookingPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "", phone: "", email: "", notes: "",
    serviceId: "", professionalId: "", date: "", time: ""
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
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug]);

  const selectedService = useMemo(() => services.find(s => s.id === form.serviceId), [form.serviceId, services]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const start = new Date(`${form.date}T${form.time}`);
      const end = new Date(start.getTime() + (selectedService?.durationMinutes ?? 60) * 60000);
      const res = await fetch(`/api/public/${slug}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          startAt: start.toISOString(),
          endAt: end.toISOString()
        })
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
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
              <Check size={28} color="#16a34a" />
            </div>
            <h2>Agendamento Realizado!</h2>
            <p style={{ color: "var(--muted)" }}>{success}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="public-booking">
      <div className="public-booking__card">
        <div className="public-booking__header">
          <h1>{company?.tradeName ?? company?.name}</h1>
          <p>Agende seu atendimento de forma rápida e prática</p>
        </div>
        <div className="public-booking__body">
          {error && <div className="error-box">{error}</div>}
          <form className="form-grid" onSubmit={submit}>
            <div className="field"><label><User size={14} style={{ verticalAlign: -2 }} /> Nome</label><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Seu nome completo" /></div>
            <div className="field"><label>Telefone</label><input required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="(00) 00000-0000" /></div>
            <div className="field full"><label>E-mail</label><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Opcional" /></div>
            <div className="field full">
              <label><DollarSign size={14} style={{ verticalAlign: -2 }} /> Serviço</label>
              <select required value={form.serviceId} onChange={e => setForm({ ...form, serviceId: e.target.value })}>
                <option value="">Selecione o serviço</option>
                {services.map(s => <option key={s.id} value={s.id}>{s.name} — {formatMoney(s.basePrice)} ({s.durationMinutes} min)</option>)}
              </select>
            </div>
            <div className="field full">
              <label>Profissional</label>
              <select required value={form.professionalId} onChange={e => setForm({ ...form, professionalId: e.target.value })}>
                <option value="">Selecione o profissional</option>
                {professionals.map(p => <option key={p.id} value={p.id}>{p.name}{p.specialty ? ` — ${p.specialty}` : ""}</option>)}
              </select>
            </div>
            <div className="field"><label><CalendarDays size={14} style={{ verticalAlign: -2 }} /> Data</label><input type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} min={new Date().toISOString().slice(0, 10)} /></div>
            <div className="field"><label><Clock size={14} style={{ verticalAlign: -2 }} /> Horário</label><input type="time" required value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} /></div>
            <div className="field full"><label>Observações</label><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Informações adicionais (opcional)" /></div>
            <div className="field full">
              <button className="button" type="submit" disabled={submitting} style={{ width: "100%", minHeight: 48, fontSize: 15 }}>
                {submitting ? "Agendando..." : "Confirmar Agendamento"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
