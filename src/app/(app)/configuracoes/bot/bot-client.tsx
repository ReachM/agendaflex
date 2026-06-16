"use client";

import { useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  CalendarDays,
  CheckCircle,
  Clock,
  HelpCircle,
  Loader2,
  MessageCircle,
  Plus,
  Save,
  Send,
  Trash2
} from "lucide-react";
import { apiFetch } from "@/lib/client-api";

type FaqItem = { pergunta: string; resposta: string };

type ReminderConfig = { enabled?: boolean; send24h?: boolean; send2h?: boolean };

type BotConfig = {
  whatsappInstance: string | null;
  connectionStatus: string;
  allowBooking: boolean;
  faqConfig: FaqItem[];
  reminderConfig: ReminderConfig;
  businessHours: string | null;
  cancellationPolicy: string | null;
};

type BotStats = {
  conversations24h: number;
  conversationsMonth: number;
  botAppointments24h: number;
  botAppointmentsMonth: number;
  reminders24h: number;
};

type ActivityRow = {
  id: string;
  type: string;
  sentAt: string;
  customerName: string;
  appointmentStartAt: string;
};

type BotResponse = {
  botEnabled: boolean;
  config: BotConfig;
  stats?: BotStats;
  recentActivity?: ActivityRow[];
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatRelative(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

export default function BotSettingsClient() {
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // Server data
  const [stats, setStats] = useState<BotStats | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);

  // Form state
  const [botEnabled, setBotEnabled] = useState(false);
  const [whatsappInstance, setWhatsappInstance] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<string>("disconnected");
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
    setConnectionStatus(data.config.connectionStatus ?? "disconnected");
    setAllowBooking(data.config.allowBooking);
    setReminderEnabled(data.config.reminderConfig?.enabled ?? true);
    setSend24h(data.config.reminderConfig?.send24h ?? true);
    setSend2h(data.config.reminderConfig?.send2h ?? true);
    setBusinessHours(data.config.businessHours ?? "");
    setCancellationPolicy(data.config.cancellationPolicy ?? "");
    setFaq(Array.isArray(data.config.faqConfig) ? data.config.faqConfig : []);
    if (data.stats) setStats(data.stats);
    if (data.recentActivity) setActivity(data.recentActivity);
  }

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  async function toggleEnabled(checked: boolean) {
    setError("");
    setBotEnabled(checked);
    try {
      await apiFetch("/api/bot-whatsapp", {
        method: "PATCH",
        body: JSON.stringify({ botEnabled: checked })
      });
      setSuccess(checked ? "Bot ativado." : "Bot desativado.");
    } catch (err) {
      setBotEnabled(!checked);
      setError((err as Error).message);
    }
  }

  // Chamado pelo QrCodeSection quando a WuzAPI confirma a conexão: reflete
  // "open" no estado pai e ativa o bot (card de STATUS passa a "Ativo").
  function handleWhatsappConnected() {
    setConnectionStatus("open");
    if (!botEnabled) {
      void toggleEnabled(true);
    }
  }

  // A rota de disconnect já desliga o bot no servidor; refletimos no estado pai.
  function handleWhatsappDisconnected() {
    setConnectionStatus("disconnected");
    setBotEnabled(false);
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
          <p className="sub">Atendimento, agendamentos e lembretes automáticos</p>
        </div>
        <div className="actions">
          <span className={`pill ${botEnabled ? "pill--success" : "pill--muted"}`}>
            <span className="dot-s" /> {botEnabled ? "Conectado" : "Desligado"}
          </span>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
            {saving ? "Salvando..." : "Salvar configurações"}
          </button>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}
      {success && <div className="success-box"><CheckCircle size={16} />{success}</div>}

      {/* Status banner */}
      {whatsappInstance && stats ? (
        <div style={{
          background: "linear-gradient(135deg, rgba(13,148,136,0.12), rgba(13,148,136,0.06))",
          border: "1px solid rgba(13,148,136,0.25)",
          borderRadius: "var(--radius-lg)",
          padding: "18px 24px",
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--success)", flexShrink: 0 }} />
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text)" }}>
              Bot está atendendo seus clientes
            </h2>
          </div>
          <div style={{ display: "flex", gap: 24, flexShrink: 0, flexWrap: "wrap" }}>
            <StatusChip label="conversas hoje" value={stats.conversations24h} />
            <StatusChip label="agendamentos via bot este mês" value={stats.botAppointmentsMonth} />
            <StatusChip label="lembretes enviados hoje" value={stats.reminders24h} />
          </div>
        </div>
      ) : !whatsappInstance ? (
        <div style={{
          background: "rgba(234,88,12,0.08)",
          border: "1px solid rgba(234,88,12,0.25)",
          borderRadius: "var(--radius-lg)",
          padding: "14px 20px",
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          gap: 12,
          color: "var(--warning)"
        }}>
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>
            Bot desconectado — configure a instância WhatsApp abaixo para ativar
          </span>
        </div>
      ) : null}

      {/* KPIs */}
      {stats ? (
        <div className="grid cols-4" style={{ marginBottom: 16 }}>
          <KpiCard label="Conversas (24h)" value={stats.conversations24h} icon={<MessageCircle size={20} />} variant="info" hint={`${stats.conversationsMonth} no mês`} />
          <KpiCard label="Agendados pelo bot (24h)" value={stats.botAppointments24h} icon={<CalendarDays size={20} />} variant="success" hint={`${stats.botAppointmentsMonth} no mês`} />
          <KpiCard label="Lembretes enviados (24h)" value={stats.reminders24h} icon={<Clock size={20} />} variant="warning" />
          <KpiCard label="Status" value={botEnabled ? "Ativo" : "Pausado"} icon={<Bot size={20} />} variant={botEnabled ? "success" : "danger"} hint={whatsappInstance ? whatsappInstance : "sem instância"} />
        </div>
      ) : null}

      <div className="grid" style={{ gridTemplateColumns: "1.6fr 1fr", gap: 16 }}>
        {/* Coluna esquerda: configurações */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Status + Toggle */}
          <section className="panel">
            <div className="panel__head" style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "var(--radius-lg)",
                  background: botEnabled
                    ? "linear-gradient(135deg, #059669, #047857)"
                    : "linear-gradient(135deg, var(--border-strong), var(--border))",
                  display: "grid", placeItems: "center", color: "white"
                }}>
                  <Bot size={22} />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="panel__title" style={{ margin: 0 }}>Bot de WhatsApp</span>
                  </div>
                  <span className="panel__sub">
                    {botEnabled ? "O bot está atendendo seus clientes." : "Ative para o bot começar a atender."}
                  </span>
                </div>
              </div>
              <label className="switch">
                <input type="checkbox" checked={botEnabled} onChange={(e) => toggleEnabled(e.target.checked)} />
                <span className="switch__track" />
                <span className="switch__label">{botEnabled ? "Desativar" : "Ativar"}</span>
              </label>
            </div>
          </section>

          {/* Conexão do WhatsApp via QR Code automático (WuzAPI) */}
          <section className="panel">
            <div className="panel__head">
              <div>
                <div className="panel__title">
                  <MessageCircle size={15} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px", color: "var(--primary)" }} />
                  Conexão do WhatsApp
                </div>
                <div className="panel__sub">Escaneie o QR Code para conectar o número que atenderá seus clientes</div>
              </div>
              {connectionStatus === "open" && (
                <span className="pill pill--success">
                  <span className="dot-s" /> Conectado
                </span>
              )}
            </div>
            <div className="panel__body">
              <QrCodeSection
                connectionStatus={connectionStatus}
                onConnected={handleWhatsappConnected}
                onDisconnected={handleWhatsappDisconnected}
              />
            </div>
          </section>

          {/* Conexão + Toggles */}
          <div className="grid cols-3">
            <section className="panel">
              <div className="panel__head">
                <div>
                  <div className="panel__title">
                    <MessageCircle size={15} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px", color: "var(--primary)" }} />
                    Conexão
                  </div>
                </div>
              </div>
              <div className="panel__body">
                <div className="field" style={{ marginBottom: 12 }}>
                  <label htmlFor="bot-instance">Instância WhatsApp</label>
                  <input
                    id="bot-instance"
                    type="text"
                    placeholder="ex: company-..."
                    value={whatsappInstance}
                    onChange={(e) => setWhatsappInstance(e.target.value)}
                    maxLength={100}
                  />
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

            <section className="panel">
              <div className="panel__head">
                <div>
                  <div className="panel__title">
                    <CalendarDays size={15} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px", color: "var(--primary)" }} />
                    Agendamento
                  </div>
                </div>
              </div>
              <div className="panel__body">
                <label className="switch" style={{ marginBottom: 12 }}>
                  <input type="checkbox" checked={allowBooking} onChange={(e) => setAllowBooking(e.target.checked)} />
                  <span className="switch__track" />
                  <span className="switch__label">Agendamento pelo bot</span>
                </label>
                <p className="muted" style={{ margin: 0, fontSize: 12, lineHeight: 1.6 }}>
                  Cliente pode marcar horários direto pela conversa.
                </p>
              </div>
            </section>

            <section className="panel">
              <div className="panel__head">
                <div>
                  <div className="panel__title">
                    <Clock size={15} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px", color: "var(--primary)" }} />
                    Lembretes
                  </div>
                </div>
              </div>
              <div className="panel__body">
                <label className="switch" style={{ marginBottom: 10 }}>
                  <input type="checkbox" checked={reminderEnabled} onChange={(e) => setReminderEnabled(e.target.checked)} />
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

          {/* Informações do negócio */}
          <section className="panel">
            <div className="panel__head">
              <div className="panel__title">Informações do negócio</div>
              <div className="panel__sub">O bot usa estes dados ao responder perguntas dos clientes.</div>
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

          {/* FAQ */}
          <section className="panel">
            <div className="panel__head">
              <div>
                <div className="panel__title">
                  <HelpCircle size={15} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px", color: "var(--primary)" }} />
                  Perguntas frequentes (FAQ)
                </div>
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
                        <button className="btn btn-danger-ghost btn-sm" type="button" onClick={() => removeFaq(index)} title="Remover">
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
        </div>

        {/* Coluna direita: preview + atividade */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Preview de conversa */}
          <section className="panel">
            <div className="panel__head">
              <div>
                <div className="panel__title">Preview da conversa</div>
                <div className="panel__sub">Exemplo de fluxo de atendimento</div>
              </div>
            </div>
            <div className="panel__body" style={{
              background: "linear-gradient(180deg, #075e54 0%, #128c7e 100%)",
              borderRadius: "var(--radius)",
              padding: 16,
              minHeight: 380
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <ChatBubble from="customer" text="Oi, gostaria de marcar um horário 😊" time="14:30" />
                <ChatBubble from="bot" text={`Olá! Eu sou o assistente. ${businessHours ? `Atendemos ${businessHours}.` : "Em que posso ajudar?"}`} time="14:30" />
                {allowBooking ? (
                  <>
                    <ChatBubble from="customer" text="Quero marcar para amanhã" time="14:31" />
                    <ChatBubble from="bot" text="Perfeito! Para qual serviço gostaria de agendar?" time="14:31" />
                    <ChatBubble from="customer" text="Corte de cabelo" time="14:32" />
                    <ChatBubble from="bot" text="Tenho 10:00, 14:00 e 16:30. Qual prefere?" time="14:32" />
                  </>
                ) : (
                  <ChatBubble from="bot" text="Para agendar, fale com nossa equipe pelos canais habituais." time="14:31" />
                )}
                {cancellationPolicy ? (
                  <>
                    <ChatBubble from="customer" text="E se eu precisar cancelar?" time="14:33" />
                    <ChatBubble from="bot" text={cancellationPolicy} time="14:33" />
                  </>
                ) : null}
                {faq.length > 0 && faq[0].pergunta ? (
                  <>
                    <ChatBubble from="customer" text={faq[0].pergunta} time="14:34" />
                    <ChatBubble from="bot" text={faq[0].resposta || "..."} time="14:34" />
                  </>
                ) : null}
              </div>
            </div>
          </section>

          {/* Atividade recente */}
          <section className="panel">
            <div className="panel__head">
              <div>
                <div className="panel__title">
                  <Activity size={14} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px", color: "var(--primary)" }} />
                  Últimas 24h
                </div>
                <div className="panel__sub">{activity.length} eventos</div>
              </div>
            </div>
            <div className="panel__body panel__body--flush">
              {activity.length === 0 ? (
                <div className="empty">Sem eventos recentes do bot.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {activity.map(a => (
                    <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--primary-ghost)", color: "var(--primary)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Clock size={14} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>
                          Lembrete {a.type} para {a.customerName}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>
                          Atendimento {formatTime(a.appointmentStartAt)} · enviado {formatRelative(a.sentAt)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function KpiCard({ label, value, icon, variant, hint }: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  variant: "success" | "danger" | "info" | "warning";
  hint?: string;
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
          <div className="stat-card__value">{String(value)}</div>
        </div>
        <div className="stat-card__icon">{icon}</div>
      </div>
      {hint ? <div className="stat-card__footer">{hint}</div> : null}
    </div>
  );
}

function StatusChip({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.1 }}>
      <span style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>{value}</span>
      <span style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>
        {label}
      </span>
    </div>
  );
}

/** Spinner circular simples reaproveitando o keyframe global `spin`. */
function Spinner({ size = 18, color = "var(--primary)" }: { size?: number; color?: string }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        border: `${Math.max(2, Math.round(size / 9))}px solid var(--border)`,
        borderTopColor: color,
        borderRadius: "50%",
        display: "inline-block",
        animation: "spin 0.7s linear infinite",
        flexShrink: 0
      }}
    />
  );
}

/**
 * Conexão do WhatsApp via QR Code automático (WuzAPI).
 *
 * O POST recria a sessão na WuzAPI; o QR é retornado diretamente por GET
 * /session/qr em ~1-2s e gravado no banco (TTL 60s). O front dispara o POST e
 * faz polling no GET a cada 3s até o QR aparecer ("qr") ou a conexão ser
 * confirmada ("connected").
 *
 * Estados: disconnected · connecting (aguardando QR) · qr (escaneável) ·
 * expired (QR venceu) · connected · error (timeout/falha).
 */
function QrCodeSection({
  connectionStatus,
  onConnected,
  onDisconnected
}: {
  connectionStatus: string;
  onConnected: () => void;
  onDisconnected?: () => void;
}) {
  type Mode = "disconnected" | "connecting" | "qr" | "connected" | "expired" | "error";

  const POLL_MS = 3000;
  const MAX_POLL_MS = 5 * 60 * 1000;
  const QR_TTL = 60;

  const [mode, setMode] = useState<Mode>(connectionStatus === "open" ? "connected" : "disconnected");
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(QR_TTL);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef(0);
  const hadQrRef = useRef(false);
  const currentQrRef = useRef<string | null>(null);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function stopCountdown() {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }

  function startCountdown() {
    stopCountdown();
    setCountdown(QR_TTL);
    countdownRef.current = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
  }

  // Reflete uma conexão já ativa vinda do estado pai (ex.: ao recarregar).
  useEffect(() => {
    if (connectionStatus === "open") setMode("connected");
  }, [connectionStatus]);

  // Limpa timers ao desmontar.
  useEffect(() => () => {
    stopPolling();
    stopCountdown();
  }, []);

  async function pollOnce() {
    if (Date.now() - startRef.current > MAX_POLL_MS) {
      stopPolling();
      stopCountdown();
      setError("Tempo esgotado aguardando a conexão. Tente novamente.");
      setMode("error");
      return;
    }
    try {
      const res = await apiFetch<{ qrcode: string | null; status: string }>("/api/bot-whatsapp/qrcode");

      if (res.status === "connected") {
        stopPolling();
        stopCountdown();
        setQrImage(null);
        currentQrRef.current = null;
        setMode("connected");
        onConnected();
        return;
      }

      if (res.status === "qr" && res.qrcode) {
        hadQrRef.current = true;
        if (currentQrRef.current !== res.qrcode) {
          currentQrRef.current = res.qrcode;
          setQrImage(res.qrcode);
          startCountdown();
        }
        setMode("qr");
        return;
      }

      // "connecting" ou "disconnected": se já houve QR antes, ele expirou.
      if (hadQrRef.current) {
        stopPolling();
        stopCountdown();
        setMode("expired");
      } else {
        setMode("connecting");
      }
    } catch (err) {
      stopPolling();
      stopCountdown();
      setError((err as Error).message);
      setMode("error");
    }
  }

  function startPolling() {
    stopPolling();
    startRef.current = Date.now();
    hadQrRef.current = false;
    currentQrRef.current = null;
    pollRef.current = setInterval(() => void pollOnce(), POLL_MS);
    void pollOnce();
  }

  async function handleConnect() {
    setError("");
    setBusy(true);
    setQrImage(null);
    setMode("connecting");
    try {
      await apiFetch("/api/bot-whatsapp/qrcode", { method: "POST" });
      startPolling();
    } catch (err) {
      setError((err as Error).message);
      setMode("error");
    } finally {
      setBusy(false);
    }
  }

  function handleCancel() {
    stopPolling();
    stopCountdown();
    setQrImage(null);
    currentQrRef.current = null;
    setMode("disconnected");
  }

  async function handleDisconnect() {
    setError("");
    setBusy(true);
    try {
      await apiFetch("/api/bot-whatsapp/disconnect", { method: "POST" });
      stopPolling();
      stopCountdown();
      setQrImage(null);
      currentQrRef.current = null;
      setMode("disconnected");
      onDisconnected?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // ── Conectado ────────────────────────────────────────────────────
  if (mode === "connected") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--success)", flexShrink: 0 }} />
          <div>
            <strong style={{ fontSize: 14 }}>WhatsApp conectado</strong>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "2px 0 0" }}>
              Bot ativo e enviando mensagens automáticas.
            </p>
          </div>
        </div>
        <button className="btn btn-danger-ghost btn-sm" type="button" onClick={handleDisconnect} disabled={busy}>
          {busy ? <Spinner size={14} color="var(--danger)" /> : <Trash2 size={14} />}
          {busy ? "Desconectando..." : "Desconectar"}
        </button>
      </div>
    );
  }

  // ── Aguardando QR (polling ativo) ────────────────────────────────
  if (mode === "connecting") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "28px 0", textAlign: "center" }}>
        <Spinner size={36} />
        <strong style={{ fontSize: 14 }}>Aguardando QR Code...</strong>
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          Gerando o código de conexão. Isso leva alguns segundos.
        </p>
        <button className="btn btn-ghost btn-sm" type="button" onClick={handleCancel}>
          Cancelar
        </button>
      </div>
    );
  }

  // ── QR Code exibido ──────────────────────────────────────────────
  if (mode === "qr" && qrImage) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "8px 0", textAlign: "center" }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrImage} alt="QR Code para conectar o WhatsApp" width={220} height={220} style={{ display: "block", width: 220, height: 220 }} />
        </div>
        <strong style={{ fontSize: 14 }}>Escaneie com seu WhatsApp</strong>
        <p className="muted" style={{ fontSize: 12.5, margin: 0, lineHeight: 1.6, maxWidth: 280 }}>
          Abra o WhatsApp › <strong>Aparelhos conectados</strong> › Conectar um aparelho.
        </p>
        <span style={{ fontSize: 12, fontWeight: 600, color: countdown <= 10 ? "var(--danger)" : "var(--muted)" }}>
          Expira em {countdown}s
        </span>
        <button className="btn btn-ghost btn-sm" type="button" onClick={handleCancel}>
          Cancelar
        </button>
      </div>
    );
  }

  // ── QR expirado ──────────────────────────────────────────────────
  if (mode === "expired") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "24px 0", textAlign: "center" }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(234,88,12,0.12)", color: "var(--warning)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Clock size={20} />
        </div>
        <strong style={{ fontSize: 14 }}>QR Code expirado</strong>
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          O código venceu antes da leitura. Gere um novo para tentar de novo.
        </p>
        <button className="btn btn-primary" type="button" onClick={handleConnect} disabled={busy}>
          {busy ? <Spinner size={14} color="#fff" /> : null}
          Gerar novo QR Code
        </button>
      </div>
    );
  }

  // ── Erro / timeout ───────────────────────────────────────────────
  if (mode === "error") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "24px 0", textAlign: "center" }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(220,38,38,0.12)", color: "var(--danger)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <AlertTriangle size={20} />
        </div>
        <strong style={{ fontSize: 14 }}>Não foi possível conectar</strong>
        <p className="muted" style={{ fontSize: 13, margin: 0, maxWidth: 320 }}>
          {error || "Algo deu errado durante a conexão."}
        </p>
        <button className="btn btn-primary" type="button" onClick={handleConnect} disabled={busy}>
          {busy ? <Spinner size={14} color="#fff" /> : null}
          Tentar novamente
        </button>
      </div>
    );
  }

  // ── Desconectado (estado inicial) ────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "20px 0", textAlign: "center" }}>
      <div style={{ width: 48, height: 48, borderRadius: "var(--radius-lg)", background: "var(--primary-ghost)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <MessageCircle size={24} />
      </div>
      <div>
        <strong style={{ fontSize: 14 }}>Conecte seu WhatsApp</strong>
        <p className="muted" style={{ fontSize: 13, margin: "4px 0 0", maxWidth: 300, lineHeight: 1.6 }}>
          Gere um QR Code e escaneie pelo app para ativar o atendimento automático.
        </p>
      </div>
      <button className="btn btn-primary" type="button" onClick={handleConnect} disabled={busy}>
        {busy ? <Spinner size={14} color="#fff" /> : <MessageCircle size={14} />}
        Conectar
      </button>
    </div>
  );
}

function ChatBubble({ from, text, time }: { from: "customer" | "bot"; text: string; time: string }) {
  const isBot = from === "bot";
  return (
    <div style={{
      alignSelf: isBot ? "flex-start" : "flex-end",
      maxWidth: "85%",
      background: isBot ? "#ffffff" : "#dcf8c6",
      color: "#0f172a",
      padding: "8px 12px",
      borderRadius: isBot ? "0 12px 12px 12px" : "12px 0 12px 12px",
      boxShadow: "0 1px 1px rgba(0,0,0,0.06)",
      fontSize: 13,
      lineHeight: 1.45
    }}>
      <div>{text}</div>
      <div style={{ fontSize: 10, color: "#64748b", textAlign: "right", marginTop: 2 }}>{time}</div>
    </div>
  );
}
