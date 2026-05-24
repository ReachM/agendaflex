"use client";

import { Bot, CheckCircle, Loader2, Plus, Save, Send, Trash2 } from "lucide-react";
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
        <div className="topbar">
          <div className="page-title">
            <h1>Bot WhatsApp</h1>
            <p className="muted">Atendimento e agendamento automático pelo WhatsApp</p>
          </div>
        </div>

        <div className="panel" style={{ textAlign: "center", padding: "48px 24px" }}>
          <Bot size={48} style={{ color: "var(--muted)", marginBottom: 16 }} />
          <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700 }}>Recurso indisponível no plano Starter</h2>
          <p className="muted" style={{ maxWidth: 440, margin: "0 auto 20px", fontSize: 14, lineHeight: 1.7 }}>
            O Bot de WhatsApp está disponível a partir do plano <strong>Pro</strong>. Faça upgrade para automatizar
            atendimento, lembretes e agendamentos pelo WhatsApp.
          </p>
          <div
            style={{
              padding: "12px 20px",
              background: "var(--warning-light)",
              borderRadius: "var(--radius)",
              display: "inline-block",
              fontSize: 14,
              color: "var(--warning)"
            }}
          >
            ⚡ Faça upgrade para o plano Pro ou Max para liberar essa funcionalidade.
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="topbar">
        <div className="page-title">
          <h1>Bot WhatsApp</h1>
          <p className="muted">Atendimento e agendamento automático pelo WhatsApp</p>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}

      {success && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "var(--radius)",
            border: "1px solid #bbf7d0",
            background: "#f0fdf4",
            color: "#15803d",
            fontSize: 13,
            fontWeight: 500,
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 8
          }}
        >
          <CheckCircle size={16} />
          {success}
        </div>
      )}

      {/* On/off switch — Company.botEnabled */}
      <section className="panel" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "var(--radius)",
                background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                display: "grid",
                placeItems: "center",
                color: "white"
              }}
            >
              <Bot size={22} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h2 className="section-title" style={{ marginBottom: 0 }}>Bot de WhatsApp</h2>
                <span className={`badge ${botEnabled ? "success" : ""}`}>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: botEnabled ? "#16a34a" : "#94a3b8",
                      display: "inline-block"
                    }}
                  />
                  {botEnabled ? "Ativo" : "Inativo"}
                </span>
              </div>
              <p className="muted" style={{ margin: 0 }}>
                {botEnabled ? "O bot está atendendo seus clientes." : "Ative para o bot começar a atender."}
              </p>
            </div>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={botEnabled}
              onChange={(e) => toggleEnabled(e.target.checked)}
              style={{ width: 18, height: 18 }}
            />
            {botEnabled ? "Desativar" : "Ativar"}
          </label>
        </div>
      </section>

      {/* Connection / instance */}
      <section className="panel" style={{ marginBottom: 16 }}>
        <h3 className="section-title" style={{ marginBottom: 16 }}>Conexão</h3>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="bot-instance">Instância do WhatsApp (Evolution API)</label>
            <input
              id="bot-instance"
              type="text"
              placeholder="ex: minha-empresa"
              value={whatsappInstance}
              onChange={(e) => setWhatsappInstance(e.target.value)}
              maxLength={100}
            />
            <small style={{ color: "var(--muted)", marginTop: 4, display: "block" }}>
              Nome da instância criada na Evolution API para esta empresa.
            </small>
          </div>
          <div className="field">
            <label htmlFor="bot-test-phone">Enviar mensagem de teste</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                id="bot-test-phone"
                type="text"
                placeholder="55 11 97777-8888"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                maxLength={20}
              />
              <button className="button secondary" type="button" onClick={handleTest} disabled={testing}>
                {testing ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
                Testar
              </button>
            </div>
            <small style={{ color: "var(--muted)", marginTop: 4, display: "block" }}>
              Salve a instância antes de testar.
            </small>
          </div>
        </div>
      </section>

      {/* Behaviour: booking + reminders */}
      <div className="grid cols-2" style={{ gap: 16, marginBottom: 16 }}>
        <section className="panel">
          <h3 className="section-title" style={{ marginBottom: 16 }}>Agendamento</h3>
          <div className="checkbox-line">
            <input
              type="checkbox"
              id="bot-allow-booking"
              checked={allowBooking}
              onChange={(e) => setAllowBooking(e.target.checked)}
            />
            <label htmlFor="bot-allow-booking">Permitir que o bot crie agendamentos</label>
          </div>
          <small style={{ color: "var(--muted)", marginTop: 8, display: "block" }}>
            Quando ativo, os clientes podem marcar horários direto pela conversa.
          </small>
        </section>

        <section className="panel">
          <h3 className="section-title" style={{ marginBottom: 16 }}>Lembretes automáticos</h3>
          <div className="checkbox-line">
            <input
              type="checkbox"
              id="bot-reminders-enabled"
              checked={reminderEnabled}
              onChange={(e) => setReminderEnabled(e.target.checked)}
            />
            <label htmlFor="bot-reminders-enabled">Ativar lembretes</label>
          </div>
          {reminderEnabled && (
            <div style={{ paddingLeft: 28, marginTop: 8, display: "grid", gap: 6 }}>
              <div className="checkbox-line">
                <input
                  type="checkbox"
                  id="bot-reminder-24h"
                  checked={send24h}
                  onChange={(e) => setSend24h(e.target.checked)}
                />
                <label htmlFor="bot-reminder-24h">24 horas antes</label>
              </div>
              <div className="checkbox-line">
                <input
                  type="checkbox"
                  id="bot-reminder-2h"
                  checked={send2h}
                  onChange={(e) => setSend2h(e.target.checked)}
                />
                <label htmlFor="bot-reminder-2h">2 horas antes</label>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Texts */}
      <section className="panel" style={{ marginBottom: 16 }}>
        <h3 className="section-title" style={{ marginBottom: 16 }}>Informações do negócio</h3>
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
      </section>

      {/* FAQ editor */}
      <section className="panel" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 className="section-title" style={{ margin: 0 }}>Perguntas frequentes (FAQ)</h3>
          <button className="button secondary" type="button" onClick={addFaq}>
            <Plus size={16} /> Adicionar
          </button>
        </div>

        {faq.length === 0 ? (
          <div className="empty">Nenhuma pergunta cadastrada. O bot usa estas respostas para tirar dúvidas dos clientes.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {faq.map((item, index) => (
              <div
                key={index}
                style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 12, display: "grid", gap: 8 }}
              >
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <input
                    type="text"
                    placeholder="Pergunta"
                    value={item.pergunta}
                    onChange={(e) => updateFaq(index, "pergunta", e.target.value)}
                    maxLength={300}
                    style={{ flex: 1 }}
                  />
                  <button
                    className="icon-button secondary"
                    type="button"
                    onClick={() => removeFaq(index)}
                    title="Remover"
                    style={{ color: "var(--danger)" }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <textarea
                  placeholder="Resposta"
                  value={item.resposta}
                  onChange={(e) => updateFaq(index, "resposta", e.target.value)}
                  maxLength={2000}
                  rows={2}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <div style={{ display: "flex", gap: 8 }}>
        <button className="button" type="button" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
          {saving ? "Salvando..." : "Salvar configurações"}
        </button>
      </div>
    </>
  );
}
