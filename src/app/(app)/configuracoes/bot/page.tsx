"use client";

import { Bot, CheckCircle, Loader2, MessageCircle, Plus, Save, Send, Trash2, Clock, CalendarDays, HelpCircle, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-api";

type FaqItem = { pergunta: string; resposta: string };

type ReminderConfig = { enabled?: boolean; send24h?: boolean; send2h?: boolean };

type BotConfig = {
  whatsappInstance: string | null;
  allowBooking: boolean;
  faqConfig: FaqItem[];
  reminderConfig: ReminderConfig;
  businessHours: string | null;
  cancellationPolicy: string | null;
};

type BotResponse = {
  botEnabled: boolean;
  config: BotConfig;
};

export default function BotSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // Form state
  const [botEnabled, setBotEnabled] = useState(false);
  const [whatsappInstance, setWhatsappInstance] = useState("");
  const [allowBooking, setAllowBooking] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [send24h, setSend24h] = useState(true);
  const [send2h, setSend2h] = useState(true);
  const [businessHours, setBusinessHours] = useState("");
  const [cancellationPolicy, setCancellationPolicy] = useState("");
  const [faq, setFaq] = useState<FaqItem[]>([]);
  const [testPhone, setTestPhone] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const me = await apiFetch<{ planFeatures?: Record<string, boolean> }>("/api/auth/me");
        if (!me.planFeatures?.allowBotIntegration) {
          setBlocked(true);
          return;
        }

        const data = await apiFetch<BotResponse>("/api/bot-whatsapp");
        applyConfig(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function applyConfig(data: BotResponse) {
    setBotEnabled(data.botEnabled);
    setWhatsappInstance(data.config.whatsappInstance ?? "");
    setAllowBooking(data.config.allowBooking);
    setReminderEnabled(data.config.reminderConfig?.enabled ?? true);
    setSend24h(data.config.reminderConfig?.send24h ?? true);
    setSend2h(data.config.reminderConfig?.send2h ?? true);
    setBusinessHours(data.config.businessHours ?? "");
    setCancellationPolicy(data.config.cancellationPolicy ?? "");
    setFaq(Array.isArray(data.config.faqConfig) ? data.config.faqConfig : []);
  }

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  async function toggleEnabled(checked: boolean) {
    setError("");
    setBotEnabled(checked); // optimistic
    try {
      await apiFetch("/api/bot-whatsapp", {
        method: "PATCH",
        body: JSON.stringify({ botEnabled: checked })
      });
      setSuccess(checked ? "Bot ativado." : "Bot desativado.");
    } catch (err) {
      setBotEnabled(!checked); // revert
      setError((err as Error).message);
    }
  }

  async function handleSave() {
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const cleanFaq = faq
        .map((f) => ({ pergunta: f.pergunta.trim(), resposta: f.resposta.trim() }))
        .filter((f) => f.pergunta && f.resposta);

      const data = await apiFetch<BotResponse>("/api/bot-whatsapp", {
        method: "PATCH",
        body: JSON.stringify({
          whatsappInstance: whatsappInstance.trim() || null,
          allowBooking,
          faqConfig: cleanFaq,
          reminderConfig: { enabled: reminderEnabled, send24h, send2h },
          businessHours: businessHours.trim() || null,
          cancellationPolicy: cancellationPolicy.trim() || null
        })
      });
      applyConfig(data);
      setSuccess("Configurações salvas com sucesso!");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setError("");
    setSuccess("");
    if (!testPhone.trim()) {
      setError("Informe um número para enviar o teste.");
      return;
    }
    setTesting(true);
    try {
      await apiFetch("/api/bot-whatsapp/test", {
        method: "POST",
        body: JSON.stringify({ phone: testPhone.trim() })
      });
      setSuccess("Mensagem de teste enviada!");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setTesting(false);
    }
  }

  function updateFaq(index: number, field: keyof FaqItem, value: string) {
    setFaq((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function addFaq() {
    setFaq((prev) => [...prev, { pergunta: "", resposta: "" }]);
  }

  function removeFaq(index: number) {
    setFaq((prev) => prev.filter((_, i) => i !== index));
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "50vh" }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  if (blocked) {
    return (
      <>
        <div className="page-header">
          <div>
            <h1>Bot WhatsApp</h1>
            <p className="sub">Atendimento e agendamento automático pelo WhatsApp</p>
          </div>
        </div>

        <section className="panel" style={{ textAlign: "center", padding: "60px 32px" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg, rgba(13,148,136,0.12), rgba(13,148,136,0.06))", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <Bot size={28} style={{ color: "var(--primary)" }} />
          </div>
          <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700 }}>Recurso indisponível no plano Starter</h2>
          <p className="muted" style={{ maxWidth: 440, margin: "0 auto 24px", fontSize: 14, lineHeight: 1.7 }}>
            O Bot de WhatsApp está disponível a partir do plano <strong>Pro</strong>. Faça upgrade para automatizar
            atendimento, lembretes e agendamentos pelo WhatsApp.
          </p>
          <button className="btn btn-amber" type="button">
            Fazer upgrade <ArrowRight size={14} />
          </button>
        </section>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Bot WhatsApp</h1>
          <p className="sub">Atendimento e agendamento automático pelo WhatsApp</p>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}
      {success && <div className="success-box"><CheckCircle size={16} />{success}</div>}

      {/* ─── Status + Toggle ─────────────────────────────── */}
      <section className="panel" style={{ marginBottom: 16 }}>
        <div className="panel__head" style={{ padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: "var(--radius-lg)",
              background: botEnabled
                ? "linear-gradient(135deg, #059669, #047857)"
                : "linear-gradient(135deg, var(--border-strong), var(--border))",
              display: "grid", placeItems: "center", color: "white",
              transition: "all var(--transition)"
            }}>
              <Bot size={22} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="panel__title" style={{ margin: 0 }}>Bot de WhatsApp</span>
                <span className={`pill ${botEnabled ? "pill--success" : "pill--muted"}`}>
                  <span className="dot-s" />
                  {botEnabled ? "Ativo" : "Inativo"}
                </span>
              </div>
              <span className="panel__sub">
                {botEnabled ? "O bot está atendendo seus clientes." : "Ative para o bot começar a atender."}
              </span>
            </div>
          </div>

          <label className="switch">
            <input
              type="checkbox"
              checked={botEnabled}
              onChange={(e) => toggleEnabled(e.target.checked)}
            />
            <span className="switch__track" />
            <span className="switch__label">{botEnabled ? "Desativar" : "Ativar"}</span>
          </label>
        </div>
      </section>

      {/* ─── Features Grid ─────────────────────────────── */}
      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        {/* Connection */}
        <section className="panel">
          <div className="panel__head">
            <div>
              <div className="panel__title"><MessageCircle size={15} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px", color: "var(--primary)" }} />Conexão</div>
            </div>
          </div>
          <div className="panel__body">
            <div className="field" style={{ marginBottom: 12 }}>
              <label htmlFor="bot-instance">Instância (Evolution API)</label>
              <input
                id="bot-instance"
                type="text"
                placeholder="ex: minha-empresa"
                value={whatsappInstance}
                onChange={(e) => setWhatsappInstance(e.target.value)}
                maxLength={100}
              />
              <span className="muted" style={{ fontSize: 11 }}>Nome da instância criada na Evolution API.</span>
            </div>
            <div className="field">
              <label htmlFor="bot-test-phone">Testar envio</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  id="bot-test-phone"
                  type="text"
                  placeholder="55 11 97777-8888"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  maxLength={20}
                />
                <button className="btn btn-ghost btn-sm" type="button" onClick={handleTest} disabled={testing}>
                  {testing ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Booking */}
        <section className="panel">
          <div className="panel__head">
            <div>
              <div className="panel__title"><CalendarDays size={15} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px", color: "var(--primary)" }} />Agendamento</div>
            </div>
          </div>
          <div className="panel__body">
            <label className="switch" style={{ marginBottom: 12 }}>
              <input
                type="checkbox"
                checked={allowBooking}
                onChange={(e) => setAllowBooking(e.target.checked)}
              />
              <span className="switch__track" />
              <span className="switch__label">Agendamento pelo bot</span>
            </label>
            <p className="muted" style={{ margin: 0, fontSize: 12, lineHeight: 1.6 }}>
              Quando ativo, os clientes podem marcar horários direto pela conversa.
            </p>
          </div>
        </section>

        {/* Reminders */}
        <section className="panel">
          <div className="panel__head">
            <div>
              <div className="panel__title"><Clock size={15} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px", color: "var(--primary)" }} />Lembretes</div>
            </div>
          </div>
          <div className="panel__body">
            <label className="switch" style={{ marginBottom: 10 }}>
              <input
                type="checkbox"
                checked={reminderEnabled}
                onChange={(e) => setReminderEnabled(e.target.checked)}
              />
              <span className="switch__track" />
              <span className="switch__label">Lembretes automáticos</span>
            </label>
            {reminderEnabled && (
              <div style={{ display: "grid", gap: 8, marginTop: 4 }}>
                <label className="switch">
                  <input type="checkbox" checked={send24h} onChange={(e) => setSend24h(e.target.checked)} />
                  <span className="switch__track" />
                  <span className="switch__label" style={{ fontSize: 12 }}>24h antes</span>
                </label>
                <label className="switch">
                  <input type="checkbox" checked={send2h} onChange={(e) => setSend2h(e.target.checked)} />
                  <span className="switch__track" />
                  <span className="switch__label" style={{ fontSize: 12 }}>2h antes</span>
                </label>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ─── Business Info ─────────────────────────────── */}
      <section className="panel" style={{ marginBottom: 16 }}>
        <div className="panel__head">
          <div className="panel__title">Informações do negócio</div>
        </div>
        <div className="panel__body">
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="bot-hours">Horário de atendimento</label>
              <input
                id="bot-hours"
                type="text"
                placeholder="Seg-Sex 8h às 18h, Sáb 8h às 12h"
                value={businessHours}
                onChange={(e) => setBusinessHours(e.target.value)}
                maxLength={500}
              />
            </div>
            <div className="field full">
              <label htmlFor="bot-cancel-policy">Política de cancelamento</label>
              <textarea
                id="bot-cancel-policy"
                placeholder="Ex: Cancelamentos devem ser feitos com pelo menos 2 horas de antecedência..."
                value={cancellationPolicy}
                onChange={(e) => setCancellationPolicy(e.target.value)}
                maxLength={1000}
                rows={2}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ─── FAQ ─────────────────────────────────────────── */}
      <section className="panel" style={{ marginBottom: 16 }}>
        <div className="panel__head">
          <div>
            <div className="panel__title"><HelpCircle size={15} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px", color: "var(--primary)" }} />Perguntas frequentes (FAQ)</div>
            <div className="panel__sub">{faq.length} {faq.length === 1 ? "pergunta" : "perguntas"} cadastradas</div>
          </div>
          <button className="btn btn-ghost btn-sm" type="button" onClick={addFaq}>
            <Plus size={14} /> Adicionar
          </button>
        </div>
        <div className="panel__body">
          {faq.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon"><HelpCircle size={24} /></div>
              <h3>Nenhuma pergunta cadastrada</h3>
              <p>O bot usa estas respostas para tirar dúvidas dos clientes automaticamente.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {faq.map((item, index) => (
                <div
                  key={index}
                  style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 14, display: "grid", gap: 8, background: "var(--surface-muted)" }}
                >
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span className="pill pill--info" style={{ flexShrink: 0, marginTop: 2 }}>#{index + 1}</span>
                    <input
                      type="text"
                      placeholder="Pergunta do cliente"
                      value={item.pergunta}
                      onChange={(e) => updateFaq(index, "pergunta", e.target.value)}
                      maxLength={300}
                      style={{ flex: 1 }}
                    />
                    <button
                      className="btn btn-danger-ghost btn-sm"
                      type="button"
                      onClick={() => removeFaq(index)}
                      title="Remover"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <textarea
                    placeholder="Resposta automática"
                    value={item.resposta}
                    onChange={(e) => updateFaq(index, "resposta", e.target.value)}
                    maxLength={2000}
                    rows={2}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ─── Save ─────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-primary" type="button" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
          {saving ? "Salvando..." : "Salvar configurações"}
        </button>
      </div>
    </>
  );
}
