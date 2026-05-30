"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Building2,
  CheckCircle2,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Link2,
  Pause,
  Plug,
  Save,
  Settings,
  Shield,
  Trash2
} from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { apiFetch } from "@/lib/client-api";
import { SubscriptionSection } from "@/components/subscription-section";

type SectionKey = "company" | "hours" | "billing" | "integrations" | "danger";

type Counts = {
  users: number;
  customers: number;
  professionals: number;
  services: number;
  appointments: number;
};

type Weekday = "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";

type DayHours = { open: boolean; from?: string; to?: string };

type CompanyProfile = {
  id: string;
  name: string;
  tradeName: string | null;
  document: string | null;
  email: string;
  phone: string | null;
  slug: string | null;
  segment: string;
  status: string;
  plan: string;
  publicBookingEnabled: boolean;
  botEnabled: boolean;
  createdAt: string;
  counts: Counts;
  businessHours: Partial<Record<Weekday, DayHours>>;
};

type Integrations = {
  invoice: { configured: boolean; autoEmit: boolean; hasNfeioKey: boolean };
  bot: { enabled: boolean; hasInstance: boolean };
  publicBooking: { enabled: boolean };
};

type ProfileResponse = { company: CompanyProfile; integrations: Integrations };

const WEEKDAYS: { id: Weekday; label: string }[] = [
  { id: "monday", label: "Segunda-feira" },
  { id: "tuesday", label: "Terça-feira" },
  { id: "wednesday", label: "Quarta-feira" },
  { id: "thursday", label: "Quinta-feira" },
  { id: "friday", label: "Sexta-feira" },
  { id: "saturday", label: "Sábado" },
  { id: "sunday", label: "Domingo" }
];

const SECTIONS: { id: SectionKey; label: string; icon: React.ReactNode; description: string }[] = [
  { id: "company", label: "Empresa", icon: <Building2 size={16} />, description: "Dados cadastrais e identidade" },
  { id: "hours", label: "Horário de funcionamento", icon: <Settings size={16} />, description: "Dias e horários de atendimento" },
  { id: "billing", label: "Plano e cobrança", icon: <CreditCard size={16} />, description: "Assinatura, faturas e cancelamento" },
  { id: "integrations", label: "Integrações", icon: <Plug size={16} />, description: "WhatsApp, notas fiscais, pagamento" },
  { id: "danger", label: "Zona de risco", icon: <AlertTriangle size={16} />, description: "Exportar, pausar, excluir" }
];

function initials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

function timeSince(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days < 30) return `${days} dia${days !== 1 ? "s" : ""}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} ${months === 1 ? "mês" : "meses"}`;
  const years = Math.floor(days / 365);
  return `${years} ano${years > 1 ? "s" : ""}`;
}

export function SettingsView() {
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [section, setSection] = useState<SectionKey>("company");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  // Form mirrors
  const [name, setName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [document, setDocument] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [slug, setSlug] = useState("");
  const [hours, setHours] = useState<Partial<Record<Weekday, DayHours>>>({});

  const load = useCallback(async () => {
    try {
      const result = await apiFetch<ProfileResponse>("/api/company/profile");
      setData(result);
      const c = result.company;
      setName(c.name);
      setTradeName(c.tradeName ?? "");
      setDocument(c.document ?? "");
      setEmail(c.email);
      setPhone(c.phone ?? "");
      setSlug(c.slug ?? "");
      setHours(c.businessHours ?? {});
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(""), 3500);
      return () => clearTimeout(t);
    }
  }, [success]);

  async function saveCompany() {
    setSaving(true); setError(""); setSuccess("");
    try {
      await apiFetch("/api/company/profile", {
        method: "PATCH",
        body: JSON.stringify({
          name,
          tradeName: tradeName || null,
          document: document || null,
          email,
          phone: phone || null,
          slug: slug || null
        })
      });
      await load();
      setSuccess("Dados da empresa atualizados.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function saveHours() {
    setSaving(true); setError(""); setSuccess("");
    try {
      await apiFetch("/api/company/profile", {
        method: "PATCH",
        body: JSON.stringify({ businessHours: hours })
      });
      await load();
      setSuccess("Horário de funcionamento atualizado.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function updateDay(day: Weekday, patch: Partial<DayHours>) {
    setHours(prev => ({
      ...prev,
      [day]: { open: prev[day]?.open ?? false, from: prev[day]?.from ?? "09:00", to: prev[day]?.to ?? "18:00", ...patch }
    }));
  }

  if (!data) {
    return (
      <>
        <PageHeader title="Configurações" subtitle="Empresa, plano e integrações" />
        {error ? <div className="error-box">{error}</div> : <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><div className="loading-spinner" /></div>}
      </>
    );
  }

  const c = data.company;

  return (
    <>
      <PageHeader
        title="Configurações"
        subtitle="Dados da empresa, plano, integrações e segurança"
      />

      {error ? <div className="error-box">{error}</div> : null}
      {success ? <div className="success-box"><CheckCircle2 size={16} />{success}</div> : null}

      {/* Card resumo da empresa */}
      <section className="panel" style={{ marginBottom: 16 }}>
        <div className="panel__body" style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div className="avatar avatar--lg av-1">{initials(c.name)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{c.name}</h2>
              <span className={`pill plan-tag plan-tag--${c.plan}`}>{c.plan.toUpperCase()}</span>
              <span className="pill pill--success"><span className="dot-s" /> {c.status}</span>
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
              {c.tradeName ? `${c.tradeName} · ` : ""}{c.segment.replaceAll("_", " ").toLowerCase()} · com a gente há {timeSince(c.createdAt)}
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <SummaryCount label="Usuários" value={c.counts.users} />
            <SummaryCount label="Profissionais" value={c.counts.professionals} />
            <SummaryCount label="Clientes" value={c.counts.customers} />
            <SummaryCount label="Serviços" value={c.counts.services} />
          </div>
        </div>
      </section>

      <div className="grid" style={{ gridTemplateColumns: "minmax(240px, 280px) 1fr", gap: 16 }}>
        {/* Sub-nav */}
        <aside className="panel" style={{ alignSelf: "start", position: "sticky", top: "calc(var(--topbar-h) + 16px)" }}>
          <div className="panel__body panel__body--flush" style={{ display: "flex", flexDirection: "column" }}>
            {SECTIONS.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSection(s.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px 18px",
                  border: 0,
                  borderLeft: section === s.id ? "3px solid var(--primary)" : "3px solid transparent",
                  borderBottom: "1px solid var(--border)",
                  background: section === s.id ? "var(--primary-ghost)" : "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  color: s.id === "danger" ? "var(--danger)" : "inherit"
                }}
              >
                <span style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: section === s.id ? "var(--primary)" : "var(--surface-muted)",
                  color: section === s.id ? "#fff" : (s.id === "danger" ? "var(--danger)" : "var(--muted)"),
                  display: "inline-flex", alignItems: "center", justifyContent: "center"
                }}>
                  {s.icon}
                </span>
                <span style={{ display: "flex", flexDirection: "column" }}>
                  <strong style={{ fontSize: 13 }}>{s.label}</strong>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>{s.description}</span>
                </span>
              </button>
            ))}
          </div>
        </aside>

        {/* Conteúdo da seção */}
        <div>
          {section === "company" ? (
            <CompanySection
              name={name} setName={setName}
              tradeName={tradeName} setTradeName={setTradeName}
              docNumber={document} setDocNumber={setDocument}
              email={email} setEmail={setEmail}
              phone={phone} setPhone={setPhone}
              slug={slug} setSlug={setSlug}
              onSave={saveCompany}
              saving={saving}
            />
          ) : null}

          {section === "hours" ? (
            <HoursSection hours={hours} updateDay={updateDay} onSave={saveHours} saving={saving} />
          ) : null}

          {section === "billing" ? <SubscriptionSection /> : null}

          {section === "integrations" ? <IntegrationsSection integrations={data.integrations} botEnabled={c.botEnabled} /> : null}

          {section === "danger" ? <DangerSection companyName={c.name} /> : null}
        </div>
      </div>
    </>
  );
}

function SummaryCount({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ textAlign: "center", padding: "8px 14px", borderLeft: "1px solid var(--border)" }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)" }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
    </div>
  );
}

function CompanySection({
  name, setName,
  tradeName, setTradeName,
  docNumber, setDocNumber,
  email, setEmail,
  phone, setPhone,
  slug, setSlug,
  onSave,
  saving
}: {
  name: string; setName: (v: string) => void;
  tradeName: string; setTradeName: (v: string) => void;
  docNumber: string; setDocNumber: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
  slug: string; setSlug: (v: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <section className="panel">
      <div className="panel__head">
        <div>
          <div className="panel__title">Dados cadastrais</div>
          <div className="panel__sub">Razão social, documentos e contatos públicos</div>
        </div>
      </div>
      <div className="panel__body">
        <div className="form-grid">
          <div className="field">
            <label>Razão social *</label>
            <input className="input" required value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Nome fantasia</label>
            <input className="input" value={tradeName} onChange={e => setTradeName(e.target.value)} />
          </div>
          <div className="field">
            <label>CNPJ / CPF</label>
            <input className="input" value={docNumber} onChange={e => setDocNumber(e.target.value)} placeholder="00.000.000/0001-00" />
          </div>
          <div className="field">
            <label>E-mail *</label>
            <input className="input" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label>Telefone</label>
            <input className="input" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <div className="field">
            <label>Slug do link público</label>
            <input
              className="input"
              value={slug}
              onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              placeholder="minha-empresa"
            />
            <small className="hint">URL: /agendar/{slug || "sua-empresa"}</small>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button type="button" className="btn btn-primary" onClick={onSave} disabled={saving}>
            <Save size={14} /> {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </div>
    </section>
  );
}

function HoursSection({
  hours, updateDay, onSave, saving
}: {
  hours: Partial<Record<Weekday, DayHours>>;
  updateDay: (day: Weekday, patch: Partial<DayHours>) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <section className="panel">
      <div className="panel__head">
        <div>
          <div className="panel__title">Horário de funcionamento</div>
          <div className="panel__sub">Define quando o bot e a página pública aceitam agendamentos</div>
        </div>
      </div>
      <div className="panel__body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {WEEKDAYS.map(({ id, label }) => {
          const day = hours[id] ?? { open: false };
          return (
            <div key={id} style={{
              display: "grid",
              gridTemplateColumns: "180px auto auto auto",
              alignItems: "center",
              gap: 12,
              padding: "10px 14px",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              background: day.open ? "var(--surface)" : "var(--surface-muted)"
            }}>
              <strong style={{ fontSize: 14 }}>{label}</strong>
              <label className="switch">
                <input type="checkbox" checked={day.open ?? false} onChange={e => updateDay(id, { open: e.target.checked })} />
                <span className="switch__track" />
                <span className="switch__label" style={{ fontSize: 12 }}>{day.open ? "Aberto" : "Fechado"}</span>
              </label>
              {day.open ? (
                <>
                  <input
                    className="input"
                    type="time"
                    value={day.from ?? "09:00"}
                    onChange={e => updateDay(id, { from: e.target.value })}
                    style={{ width: 120 }}
                  />
                  <input
                    className="input"
                    type="time"
                    value={day.to ?? "18:00"}
                    onChange={e => updateDay(id, { to: e.target.value })}
                    style={{ width: 120 }}
                  />
                </>
              ) : (
                <span style={{ gridColumn: "3 / span 2", color: "var(--muted)", fontSize: 13 }}>—</span>
              )}
            </div>
          );
        })}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
          <button type="button" className="btn btn-primary" onClick={onSave} disabled={saving}>
            <Save size={14} /> {saving ? "Salvando..." : "Salvar horários"}
          </button>
        </div>
      </div>
    </section>
  );
}

function IntegrationsSection({ integrations, botEnabled }: { integrations: Integrations; botEnabled: boolean }) {
  return (
    <section className="panel">
      <div className="panel__head">
        <div>
          <div className="panel__title">Integrações</div>
          <div className="panel__sub">Conecte ferramentas externas e canais de atendimento</div>
        </div>
      </div>
      <div className="panel__body" style={{ display: "grid", gap: 12 }}>
        <IntegrationCard
          icon={<Bot size={20} />}
          name="Bot WhatsApp (Evolution API)"
          description="Atendimento automático, lembretes e agendamento pelo WhatsApp"
          status={botEnabled && integrations.bot.hasInstance ? "Conectado" : integrations.bot.hasInstance ? "Configurado, desligado" : "Não configurado"}
          variant={botEnabled && integrations.bot.hasInstance ? "success" : "warning"}
          href="/configuracoes/bot"
        />
        <IntegrationCard
          icon={<FileText size={20} />}
          name="NFE.io (notas fiscais)"
          description="Emissão automática de notas fiscais eletrônicas"
          status={integrations.invoice.hasNfeioKey ? (integrations.invoice.autoEmit ? "Conectado · automático" : "Conectado · manual") : integrations.invoice.configured ? "Emissor cadastrado, sem chave NFE.io" : "Não configurado"}
          variant={integrations.invoice.hasNfeioKey ? "success" : "warning"}
          href="/notas-fiscais"
        />
        <IntegrationCard
          icon={<Link2 size={20} />}
          name="Link público de agendamento"
          description="Página pública para clientes marcarem horários"
          status={integrations.publicBooking.enabled ? "Ativo" : "Inativo"}
          variant={integrations.publicBooking.enabled ? "success" : "muted"}
          href="/link-agenda"
        />
        <IntegrationCard
          icon={<CreditCard size={20} />}
          name="Mercado Pago"
          description="Gateway de pagamento para assinaturas recorrentes"
          status="Gerenciado pela plataforma"
          variant="info"
          external
        />
      </div>
    </section>
  );
}

function IntegrationCard({
  icon, name, description, status, variant, href, external
}: {
  icon: React.ReactNode;
  name: string;
  description: string;
  status: string;
  variant: "success" | "warning" | "muted" | "info";
  href?: string;
  external?: boolean;
}) {
  const pillCls: Record<string, string> = {
    success: "pill--success",
    warning: "pill--warn",
    muted: "pill--muted",
    info: "pill--info"
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: 16, border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--surface)" }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: "var(--primary-ghost)", color: "var(--primary)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <strong style={{ fontSize: 14 }}>{name}</strong>
          <span className={`pill ${pillCls[variant]}`}><span className="dot-s" /> {status}</span>
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{description}</div>
      </div>
      {href ? (
        external ? (
          <a href={href} target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost">
            Abrir <ExternalLink size={12} />
          </a>
        ) : (
          <Link href={href} className="btn btn-sm btn-ghost">
            Configurar <ExternalLink size={12} />
          </Link>
        )
      ) : null}
    </div>
  );
}

function DangerSection({ companyName }: { companyName: string }) {
  return (
    <section className="panel" style={{ borderColor: "var(--danger-light)" }}>
      <div className="panel__head">
        <div>
          <div className="panel__title" style={{ color: "var(--danger)" }}><Shield size={14} style={{ display: "inline", marginRight: 6 }} />Zona de risco</div>
          <div className="panel__sub">Ações sensíveis. Pense bem antes de prosseguir.</div>
        </div>
      </div>
      <div className="panel__body" style={{ display: "grid", gap: 12 }}>
        <DangerRow
          icon={<Download size={20} />}
          title="Exportar dados da empresa"
          description="Baixe um arquivo JSON com clientes, agendamentos e configurações para fins LGPD."
          action="Em breve"
          actionVariant="ghost"
        />
        <DangerRow
          icon={<Pause size={20} />}
          title="Pausar conta temporariamente"
          description="Suspende novos atendimentos sem perder seus dados. Você pode reativar a qualquer momento."
          action="Em breve"
          actionVariant="ghost"
        />
        <DangerRow
          icon={<Trash2 size={20} />}
          title={`Excluir ${companyName} permanentemente`}
          description="Remove a empresa e todos os dados após 30 dias de carência. Esta ação não pode ser desfeita."
          action="Solicitar exclusão"
          actionVariant="danger"
          disabled
        />
      </div>
    </section>
  );
}

function DangerRow({
  icon, title, description, action, actionVariant, disabled
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: string;
  actionVariant: "ghost" | "danger";
  disabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: 16, border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: "var(--danger-light)", color: "var(--danger)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ fontSize: 14 }}>{title}</strong>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{description}</div>
      </div>
      <button
        type="button"
        className={`btn btn-sm ${actionVariant === "danger" ? "btn-danger-ghost" : "btn-ghost"}`}
        disabled={disabled}
        title={disabled ? "Funcionalidade em desenvolvimento" : undefined}
      >
        {action}
      </button>
    </div>
  );
}
