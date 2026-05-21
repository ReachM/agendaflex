"use client";

import { Bot, CheckCircle, Loader2, MessageSquare, Unplug, Wifi, X } from "lucide-react";
import { useEffect, useState } from "react";

type BotStatus = {
  enabled: boolean;
  connectedAt?: string;
  plan?: string;
};

type BotConfig = {
  faqContext?: string;
  businessHours?: string;
  address?: string;
  cancellationPolicy?: string;
  reminders?: {
    enabled?: boolean;
    hours?: number[];
  };
};

export default function BotSettingsPage() {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);

  // Config form state
  const [faqContext, setFaqContext] = useState("");
  const [businessHours, setBusinessHours] = useState("");
  const [address, setAddress] = useState("");
  const [cancellationPolicy, setCancellationPolicy] = useState("");
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [reminder24h, setReminder24h] = useState(true);
  const [reminder2h, setReminder2h] = useState(true);

  // Session for plan check
  const [session, setSession] = useState<{ company?: { plan?: string } } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then((r) => r.json()),
      fetch("/api/bot/status").then((r) => r.json())
    ])
      .then(([me, botStatus]) => {
        setSession(me);
        setStatus(botStatus);

        // Load existing config if connected
        if (botStatus.enabled) {
          loadConfig();
        }
      })
      .catch(() => setError("Erro ao carregar dados."))
      .finally(() => setLoading(false));
  }, []);

  async function loadConfig() {
    try {
      const res = await fetch("/api/bot/config");
      if (!res.ok) return;
      const data = await res.json();
      const config = data as BotConfig;
      setFaqContext(config.faqContext ?? "");
      setBusinessHours(config.businessHours ?? "");
      setAddress(config.address ?? "");
      setCancellationPolicy(config.cancellationPolicy ?? "");
      setRemindersEnabled(config.reminders?.enabled ?? true);
      setReminder24h(config.reminders?.hours?.includes(24) ?? true);
      setReminder2h(config.reminders?.hours?.includes(2) ?? true);
    } catch {
      // silently fail
    }
  }

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  async function handleConnect() {
    clearMessages();
    if (!apiKey.trim()) {
      setError("Informe a API Key do ChatBot Service.");
      return;
    }

    setConnecting(true);
    try {
      const res = await fetch("/api/bot/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatbotApiKey: apiKey })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erro ao conectar o bot.");
        return;
      }

      setSuccess("Bot conectado com sucesso!");
      setApiKey("");
      setStatus({ enabled: true, connectedAt: data.connectedAt, plan: status?.plan });
    } catch {
      setError("Erro de rede. Tente novamente.");
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    clearMessages();
    setDisconnecting(true);
    try {
      const res = await fetch("/api/bot/connect", { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erro ao desconectar o bot.");
        return;
      }

      setSuccess("Bot desconectado.");
      setStatus({ enabled: false, plan: status?.plan });
      setShowDisconnectModal(false);
    } catch {
      setError("Erro de rede. Tente novamente.");
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleSaveConfig() {
    clearMessages();
    setSaving(true);
    try {
      const hours: number[] = [];
      if (reminder24h) hours.push(24);
      if (reminder2h) hours.push(2);

      const res = await fetch("/api/bot/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          faqContext: faqContext || undefined,
          businessHours: businessHours || undefined,
          address: address || undefined,
          cancellationPolicy: cancellationPolicy || undefined,
          remindersEnabled,
          reminderHours: hours
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erro ao salvar configurações.");
        return;
      }

      setSuccess("Configurações salvas com sucesso!");
    } catch {
      setError("Erro de rede. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  // Auto-hide success messages
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "50vh" }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  const planSlug = session?.company?.plan ?? "starter";
  const isStarter = planSlug === "starter";

  if (isStarter) {
    return (
      <>
        <div className="topbar">
          <div className="page-title">
            <h1>Bot WhatsApp</h1>
            <p className="muted">Integração com bot de WhatsApp com IA</p>
          </div>
        </div>

        <div className="panel" style={{ textAlign: "center", padding: "48px 24px" }}>
          <Bot size={48} style={{ color: "var(--muted)", marginBottom: 16 }} />
          <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700 }}>Recurso indisponível no plano Starter</h2>
          <p className="muted" style={{ maxWidth: 420, margin: "0 auto", fontSize: 14, lineHeight: 1.7 }}>
            A integração com Bot WhatsApp está disponível a partir do plano <strong>Pro</strong>.
            Faça upgrade para conectar um bot de IA e automatizar seus agendamentos via WhatsApp.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="topbar">
        <div className="page-title">
          <h1>Bot WhatsApp</h1>
          <p className="muted">Integração com bot de WhatsApp com IA</p>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}

      {success && (
        <div
          style={{
            padding: "14px 16px",
            borderRadius: "var(--radius)",
            border: "1px solid #bbf7d0",
            background: "#f0fdf4",
            color: "#15803d",
            fontSize: 13,
            fontWeight: 500,
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 8,
            animation: "slideDown 0.2s ease-out"
          }}
        >
          <CheckCircle size={16} />
          {success}
        </div>
      )}

      {!status?.enabled ? (
        /* ─── Not Connected ─── */
        <div className="panel" style={{ maxWidth: 600 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
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
              <h2 className="section-title" style={{ marginBottom: 2 }}>Conectar Bot WhatsApp</h2>
              <p className="muted" style={{ margin: 0 }}>
                Cole a API Key fornecida pelo ChatBot Service para ativar o bot.
              </p>
            </div>
          </div>

          <div
            style={{
              padding: 16,
              borderRadius: "var(--radius)",
              background: "var(--info-light)",
              border: "1px solid #bfdbfe",
              marginBottom: 20,
              fontSize: 13,
              lineHeight: 1.7,
              color: "#1e40af"
            }}
          >
            <strong>Como funciona:</strong> O bot de IA atenderá seus clientes no WhatsApp, consultando seus serviços,
            verificando horários disponíveis e criando agendamentos automaticamente.
          </div>

          <div className="field" style={{ marginBottom: 16 }}>
            <label htmlFor="bot-api-key">API Key do ChatBot Service</label>
            <input
              id="bot-api-key"
              type="text"
              placeholder="chatbot_sk_..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={connecting}
            />
          </div>

          <button
            className="button"
            onClick={handleConnect}
            disabled={connecting || !apiKey.trim()}
            type="button"
          >
            {connecting ? <Loader2 size={16} className="spin" /> : <Wifi size={16} />}
            {connecting ? "Conectando..." : "Conectar bot"}
          </button>
        </div>
      ) : (
        /* ─── Connected ─── */
        <>
          {/* Status Card */}
          <div className="panel" style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
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
                  <MessageSquare size={22} />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <h2 className="section-title" style={{ marginBottom: 0 }}>Bot WhatsApp</h2>
                    <span className="badge success">
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a", display: "inline-block" }} />
                      Ativo
                    </span>
                  </div>
                  {status.connectedAt && (
                    <p className="muted" style={{ margin: 0 }}>
                      Conectado em {new Date(status.connectedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                </div>
              </div>

              <button
                className="button secondary"
                onClick={() => setShowDisconnectModal(true)}
                type="button"
                style={{ color: "var(--danger)" }}
              >
                <Unplug size={16} />
                Desconectar
              </button>
            </div>
          </div>

          {/* Config Form */}
          <div className="panel">
            <h3 className="section-title" style={{ marginBottom: 16 }}>Configurações do Bot</h3>

            <div style={{ display: "grid", gap: 16 }}>
              <div className="field full">
                <label htmlFor="bot-faq">Contexto para FAQ</label>
                <textarea
                  id="bot-faq"
                  placeholder="Descreva informações frequentes sobre seu negócio que o bot pode usar para responder perguntas..."
                  value={faqContext}
                  onChange={(e) => setFaqContext(e.target.value)}
                  maxLength={2000}
                  rows={4}
                />
                <span className="muted">{faqContext.length}/2000 caracteres</span>
              </div>

              <div className="form-grid">
                <div className="field">
                  <label htmlFor="bot-hours">Horário de funcionamento</label>
                  <input
                    id="bot-hours"
                    type="text"
                    placeholder="Seg-Sex 8h às 18h, Sáb 8h às 12h"
                    value={businessHours}
                    onChange={(e) => setBusinessHours(e.target.value)}
                    maxLength={200}
                  />
                </div>

                <div className="field">
                  <label htmlFor="bot-address">Endereço</label>
                  <input
                    id="bot-address"
                    type="text"
                    placeholder="Rua, número, bairro, cidade"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    maxLength={300}
                  />
                </div>
              </div>

              <div className="field full">
                <label htmlFor="bot-cancel-policy">Política de cancelamento</label>
                <textarea
                  id="bot-cancel-policy"
                  placeholder="Ex: Cancelamentos devem ser feitos com pelo menos 2 horas de antecedência..."
                  value={cancellationPolicy}
                  onChange={(e) => setCancellationPolicy(e.target.value)}
                  maxLength={500}
                  rows={2}
                />
              </div>

              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Lembretes automáticos</h4>

                <div className="checkbox-line">
                  <input
                    type="checkbox"
                    id="bot-reminders-enabled"
                    checked={remindersEnabled}
                    onChange={(e) => setRemindersEnabled(e.target.checked)}
                  />
                  <label htmlFor="bot-reminders-enabled">Ativar lembretes automáticos</label>
                </div>

                {remindersEnabled && (
                  <div style={{ paddingLeft: 28, marginTop: 8, display: "grid", gap: 6 }}>
                    <div className="checkbox-line">
                      <input
                        type="checkbox"
                        id="bot-reminder-24h"
                        checked={reminder24h}
                        onChange={(e) => setReminder24h(e.target.checked)}
                      />
                      <label htmlFor="bot-reminder-24h">24 horas antes</label>
                    </div>
                    <div className="checkbox-line">
                      <input
                        type="checkbox"
                        id="bot-reminder-2h"
                        checked={reminder2h}
                        onChange={(e) => setReminder2h(e.target.checked)}
                      />
                      <label htmlFor="bot-reminder-2h">2 horas antes</label>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginTop: 20, display: "flex", gap: 8 }}>
              <button
                className="button"
                onClick={handleSaveConfig}
                disabled={saving}
                type="button"
              >
                {saving ? <Loader2 size={16} className="spin" /> : null}
                {saving ? "Salvando..." : "Salvar configurações"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Disconnect confirmation modal */}
      {showDisconnectModal && (
        <div className="modal-overlay" onClick={() => setShowDisconnectModal(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: 480 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 className="section-title" style={{ margin: 0 }}>Desconectar Bot</h3>
              <button
                className="icon-button secondary"
                onClick={() => setShowDisconnectModal(false)}
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: "0 0 20px", fontSize: 14, lineHeight: 1.7, color: "var(--text-secondary)" }}>
              Tem certeza que deseja desconectar o bot de WhatsApp?
              <br />
              <strong>Esta ação irá:</strong>
            </p>
            <ul style={{ margin: "0 0 20px", paddingLeft: 20, fontSize: 13, lineHeight: 2, color: "var(--text-secondary)" }}>
              <li>Desativar o bot de atendimento</li>
              <li>Remover a integração com o ChatBot Service</li>
              <li>Clientes não serão mais atendidos pelo bot</li>
            </ul>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                className="button secondary"
                onClick={() => setShowDisconnectModal(false)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="button danger"
                onClick={handleDisconnect}
                disabled={disconnecting}
                type="button"
              >
                {disconnecting ? <Loader2 size={16} className="spin" /> : <Unplug size={16} />}
                {disconnecting ? "Desconectando..." : "Desconectar bot"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
