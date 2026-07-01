"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Home,
  Lock,
  MessageCircle,
  MessageSquare,
  Navigation,
  Palette,
  Pause,
  Pencil,
  Plus,
  Save,
  Share2,
  Shield,
  Star,
  Trash2,
  User,
  Users,
  X
} from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { apiFetch } from "@/lib/client-api";
import { maskDocument, maskPhone } from "@/lib/utils/masks";

type SectionKey =
  | "profile"
  | "hours"
  | "billing"
  | "users"
  | "permissions"
  | "appearance"
  | "custom-fields"
  | "notifications"
  | "integrations"
  | "api"
  | "logs"
  | "me"
  | "security";

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
  address: string | null;
  slug: string | null;
  segment: string;
  status: string;
  plan: string;
  publicBookingEnabled: boolean;
  botEnabled: boolean;
  createdAt: string;
  counts: Counts;
  businessHours: Partial<Record<Weekday, DayHours>>;
  adminEmail: string;
};

type Integrations = {
  invoice: { configured: boolean; autoEmit: boolean; hasNfeioKey: boolean };
  bot: { enabled: boolean; hasInstance: boolean };
  publicBooking: { enabled: boolean };
};

type ProfileResponse = { company: CompanyProfile; integrations: Integrations };

type ApiUser = {
  id: string;
  userId: string;
  user: { id: string; name: string; email: string; status: string };
  role: { id: string; name: string };
};

type ThirdPartyIntegration = {
  id: string;
  type: string;
  isActive: boolean;
  apiKeyHint: string | null;
};

const WEEKDAYS: { id: Weekday; label: string; short: string }[] = [
  { id: "monday", label: "Segunda-feira", short: "Seg" },
  { id: "tuesday", label: "Terça-feira", short: "Ter" },
  { id: "wednesday", label: "Quarta-feira", short: "Qua" },
  { id: "thursday", label: "Quinta-feira", short: "Qui" },
  { id: "friday", label: "Sexta-feira", short: "Sex" },
  { id: "saturday", label: "Sábado", short: "Sáb" },
  { id: "sunday", label: "Domingo", short: "Dom" }
];

const NAV_SECTIONS: { group: string; items: { key: SectionKey; label: string; icon: React.ReactNode }[] }[] = [
  {
    group: "Empresa",
    items: [
      { key: "profile", label: "Perfil da empresa", icon: <Home size={15} /> },
      { key: "hours", label: "Horário de funcionamento", icon: <Clock size={15} /> },
      { key: "billing", label: "Plano e cobrança", icon: <CreditCard size={15} /> }
    ]
  },
  {
    group: "Equipe",
    items: [
      { key: "users", label: "Usuários", icon: <Users size={15} /> },
      { key: "permissions", label: "Perfis e permissões", icon: <Lock size={15} /> }
    ]
  },
  {
    group: "Personalização",
    items: [
      { key: "appearance", label: "Aparência", icon: <Palette size={15} /> },
      { key: "custom-fields", label: "Campos personalizados", icon: <Navigation size={15} /> },
      { key: "notifications", label: "Notificações", icon: <MessageSquare size={15} /> }
    ]
  },
  {
    group: "Conexões",
    items: [
      { key: "integrations", label: "Integrações", icon: <Share2 size={15} /> },
      { key: "logs", label: "Logs de atividade", icon: <FileText size={15} /> }
    ]
  },
  {
    group: "Conta",
    items: [
      { key: "me", label: "Meu perfil", icon: <User size={15} /> },
      { key: "security", label: "Segurança", icon: <Shield size={15} /> }
    ]
  }
];

const NOTIFICATION_DEFS = [
  {
    key: "newBooking" as const,
    title: "Novo agendamento via link público",
    desc: "Push + e-mail quando alguém marca pela página pública."
  },
  {
    key: "cancellation" as const,
    title: "Cancelamento de cliente",
    desc: "Aviso imediato se um cliente cancela um agendamento confirmado."
  },
  {
    key: "dailySummary" as const,
    title: "Fechamento diário",
    desc: "Resumo do dia (faturamento, atendimentos, ocupação) às 21h."
  },
  {
    key: "vipBooking" as const,
    title: "Cliente VIP marcando horário",
    desc: "Push para o gerente quando um cliente VIP (≥R$ 2k/ano) agenda."
  }
];

type NotificationKey = (typeof NOTIFICATION_DEFS)[number]["key"];

function initials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

function yearsActive(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  return Math.max(1, Math.floor(diff / (365 * 24 * 60 * 60 * 1000)));
}

function avatarColorIndex(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return (hash % 8) + 1;
}

function classifyRole(roleName: string): "owner" | "admin" | "staff" {
  const n = roleName.toLowerCase();
  if (n.includes("owner") || n.includes("dona") || n.includes("dono")) return "owner";
  if (n.includes("admin") || n.includes("gerente") || n.includes("manager")) return "admin";
  return "staff";
}

function roleLabel(role: "owner" | "admin" | "staff") {
  if (role === "owner") return "★ Dona";
  if (role === "admin") return "Gerente";
  return "Profissional";
}

export function SettingsView() {
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [section, setSection] = useState<SectionKey>("profile");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  // Form mirrors (dirty tracking)
  const [name, setName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [document, setDocument] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [hours, setHours] = useState<Partial<Record<Weekday, DayHours>>>({});

  // Local-only state
  const [notifications, setNotifications] = useState<Record<NotificationKey, boolean>>({
    newBooking: true,
    cancellation: true,
    dailySummary: false,
    vipBooking: true
  });

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
      setAddress(c.address ?? "");
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

  const dirty = useMemo(() => {
    if (!data) return false;
    const c = data.company;
    if (name !== c.name) return true;
    if ((tradeName || null) !== (c.tradeName ?? null)) return true;
    if ((document || null) !== (c.document ?? null)) return true;
    if (email !== c.email) return true;
    if ((phone || null) !== (c.phone ?? null)) return true;
    if ((address || null) !== (c.address ?? null)) return true;
    if (JSON.stringify(hours) !== JSON.stringify(c.businessHours ?? {})) return true;
    return false;
  }, [data, name, tradeName, document, email, phone, address, hours]);

  async function handleSave() {
    if (!dirty) return;
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
          address: address || null,
          businessHours: hours
        })
      });
      await load();
      setSuccess("Alterações salvas com sucesso.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    if (!dirty || !data) return;
    const c = data.company;
    setName(c.name);
    setTradeName(c.tradeName ?? "");
    setDocument(c.document ?? "");
    setEmail(c.email);
    setPhone(c.phone ?? "");
    setAddress(c.address ?? "");
    setHours(c.businessHours ?? {});
  }

  function updateDay(day: Weekday, patch: Partial<DayHours>) {
    setHours(prev => ({
      ...prev,
      [day]: {
        open: prev[day]?.open ?? false,
        from: prev[day]?.from ?? "09:00",
        to: prev[day]?.to ?? "18:00",
        ...patch
      }
    }));
  }

  if (!data) {
    return (
      <>
        <PageHeader title="Configurações" subtitle="Empresa, equipe, integrações e preferências do sistema" />
        {error ? <div className="error-box">{error}</div> : (
          <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
            <div className="loading-spinner" />
          </div>
        )}
      </>
    );
  }

  const c = data.company;

  return (
    <>
      <PageHeader
        title="Configurações"
        subtitle="Empresa, equipe, integrações e preferências do sistema"
        actions={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleDiscard}
              disabled={!dirty || saving}
            >
              Descartar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={!dirty || saving}
            >
              <Save size={15} /> {saving ? "Salvando..." : "Salvar alterações"}
            </button>
          </>
        }
      />

      {error ? <div className="error-box">{error}</div> : null}
      {success ? <div className="success-box"><CheckCircle2 size={16} />{success}</div> : null}

      <div className="cfg-layout">
        <aside className="cfg-side">
          {NAV_SECTIONS.map(group => (
            <Fragment key={group.group}>
              <div className="cfg-side__group">{group.group}</div>
              {group.items.map(item => (
                <button
                  key={item.key}
                  type="button"
                  className={`cfg-side__item${section === item.key ? " is-on" : ""}`}
                  onClick={() => setSection(item.key)}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </Fragment>
          ))}
        </aside>

        <section>
          <BizHead company={c} />

          {section === "profile" && (
            <ProfileSection
              name={name}
              tradeName={tradeName} setTradeName={setTradeName}
              docNumber={document}
              email={email}
              phone={phone} setPhone={setPhone}
              currentSlug={c.slug ?? ""}
            />
          )}

          {section === "hours" && (
            <HoursSection hours={hours} updateDay={updateDay} />
          )}

          {(section === "billing" || section === "users") && (
            <BillingAndUsersSection plan={c.plan} />
          )}

          {section === "notifications" && (
            <NotificationsSection
              notifications={notifications}
              setNotifications={setNotifications}
            />
          )}

          {section === "integrations" && (
            <IntegrationsSection
              builtIn={data.integrations}
              botEnabled={c.botEnabled}
              publicBookingEnabled={c.publicBookingEnabled}
            />
          )}

          {section === "security" && (
            <DangerZone companyName={c.name} adminEmail={c.adminEmail} />
          )}

          {(section === "permissions" ||
            section === "appearance" ||
            section === "custom-fields" ||
            section === "logs" ||
            section === "me") && (
            <ComingSoon sectionKey={section} />
          )}
        </section>
      </div>
    </>
  );
}

/* ─── Hero da empresa ─────────────────────────────── */

function BizHead({ company }: { company: CompanyProfile }) {
  return (
    <div className="cfg-biz-head">
      <span className="cfg-biz-head__avt">{initials(company.name)}</span>
      <div className="cfg-biz-head__col">
        <h2>{company.tradeName || company.name}</h2>
        <p>
          {company.segment.replaceAll("_", " ").toLowerCase()}
          {company.slug ? ` · marcaiflex.com/${company.slug}` : ""}
        </p>
        <div className="cfg-biz-head__chips">
          <span className="cfg-chip-meta cfg-chip-meta--plan">
            <Star size={11} fill="currentColor" />
            Plano {company.plan.charAt(0).toUpperCase() + company.plan.slice(1).toLowerCase()}
          </span>
          <span className="cfg-chip-meta">
            <Clock size={11} /> Aberto há {yearsActive(company.createdAt)}{" "}
            {yearsActive(company.createdAt) === 1 ? "ano" : "anos"}
          </span>
          <span className="cfg-chip-meta">
            <Users size={11} /> {company.counts.professionals} profissionais
          </span>
          <span className="cfg-chip-meta">
            <Star size={11} /> {company.counts.customers} clientes
          </span>
        </div>
      </div>
      <button type="button" className="btn btn-ghost btn-sm" disabled title="Em breve">
        <Pencil size={13} /> Editar logo
      </button>
    </div>
  );
}

/* ─── Section Card wrapper ────────────────────────── */

function SectionCard({
  icon,
  iconBg,
  iconColor,
  title,
  description,
  action,
  children
}: {
  icon: React.ReactNode;
  iconBg?: string;
  iconColor?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="cfg-section-card">
      <div className="cfg-section-card__head">
        <span
          className="ico"
          style={iconBg || iconColor ? { background: iconBg, color: iconColor } : undefined}
        >
          {icon}
        </span>
        <div className="col">
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        {action}
      </div>
      <div className="cfg-section-card__body">{children}</div>
    </section>
  );
}

/* ─── Profile ─────────────────────────────────────── */

function ProfileSection({
  name,
  tradeName, setTradeName,
  docNumber,
  email,
  phone, setPhone,
  currentSlug
}: {
  name: string;
  tradeName: string; setTradeName: (v: string) => void;
  docNumber: string;
  email: string;
  phone: string; setPhone: (v: string) => void;
  currentSlug: string;
}) {
  const bookingLink = `marcaiflex.com.br/agendar/${currentSlug || "sua-empresa"}`;

  return (
    <SectionCard
      icon={<Home size={18} />}
      title="Dados da empresa"
      description="Informações usadas em notas fiscais, recibos e link público."
    >
      <div className="cfg-row-2">
        <div className="cfg-field">
          <label htmlFor="cfg-name">Razão social</label>
          <input id="cfg-name" value={name} readOnly disabled className="is-readonly" />
          <small>
            Para alterar: <a href="mailto:contato@marcaiflex.com.br">contato@marcaiflex.com.br</a>
          </small>
        </div>
        <div className="cfg-field">
          <label htmlFor="cfg-trade">Nome fantasia</label>
          <input id="cfg-trade" value={tradeName} onChange={e => setTradeName(e.target.value)} />
        </div>
        <div className="cfg-field">
          <label htmlFor="cfg-doc">CNPJ / CPF</label>
          <input
            id="cfg-doc"
            value={docNumber ? maskDocument(docNumber) : ""}
            readOnly
            disabled
            className="is-readonly"
          />
          <small>
            Para alterar: <a href="mailto:contato@marcaiflex.com.br">contato@marcaiflex.com.br</a>
          </small>
        </div>
        <div className="cfg-field">
          <label htmlFor="cfg-email">E-mail da empresa</label>
          <input id="cfg-email" type="email" value={email} readOnly disabled className="is-readonly" />
          <small>
            Para alterar: <a href="mailto:contato@marcaiflex.com.br">contato@marcaiflex.com.br</a>
          </small>
        </div>
        <div className="cfg-field">
          <label htmlFor="cfg-phone">Telefone</label>
          <input
            id="cfg-phone"
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={e => setPhone(maskPhone(e.target.value))}
            placeholder="(11) 99999-9999"
          />
        </div>
        <div className="cfg-field">
          <label htmlFor="cfg-slug">Seu link de agendamento</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input id="cfg-slug" value={bookingLink} readOnly disabled className="is-readonly" />
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void navigator.clipboard.writeText(`https://${bookingLink}`)}
            >
              Copiar
            </button>
          </div>
          <small>
            Para alterar o link: <a href="mailto:contato@marcaiflex.com.br">contato@marcaiflex.com.br</a>
          </small>
        </div>
      </div>
    </SectionCard>
  );
}

/* ─── Horários ────────────────────────────────────── */

function HoursSection({
  hours,
  updateDay
}: {
  hours: Partial<Record<Weekday, DayHours>>;
  updateDay: (day: Weekday, patch: Partial<DayHours>) => void;
}) {
  return (
    <SectionCard
      icon={<Clock size={18} />}
      iconBg="var(--accent-light)"
      iconColor="var(--accent)"
      title="Horário de funcionamento"
      description="Determina os horários disponíveis na página pública e no bot."
    >
      {WEEKDAYS.map(({ id, short }) => {
        const day = hours[id] ?? { open: false };
        return (
          <div key={id} className="cfg-hours-row">
            <span className="cfg-hours-row__day">{short}</span>
            {day.open ? (
              <>
                <input
                  type="time"
                  value={day.from ?? "09:00"}
                  onChange={e => updateDay(id, { from: e.target.value })}
                />
                <input
                  type="time"
                  value={day.to ?? "18:00"}
                  onChange={e => updateDay(id, { to: e.target.value })}
                />
              </>
            ) : (
              <div className="cfg-hours-row__closed">Fechado</div>
            )}
            <label className="switch">
              <input
                type="checkbox"
                checked={day.open ?? false}
                onChange={e => updateDay(id, { open: e.target.checked })}
              />
              <span className="switch__track" />
            </label>
          </div>
        );
      })}
    </SectionCard>
  );
}

/* ─── Plano + Usuários ────────────────────────────── */

function BillingAndUsersSection({ plan }: { plan: string }) {
  const planUpper = plan.toUpperCase();
  const isPro = planUpper === "PRO";
  const isMax = planUpper === "MAX";

  const features = [
    { label: "Agenda, clientes e profissionais", included: true },
    { label: "Link público de agendamento", included: true },
    { label: "Financeiro completo + DRE", included: isPro || isMax },
    { label: "Notas fiscais automáticas", included: isPro || isMax },
    { label: "Relatórios avançados", included: isPro || isMax },
    { label: "Bot WhatsApp (Evolution)", included: isMax }
  ];

  const planPrice = isMax ? "179" : isPro ? "99" : "49";
  const planName = isMax ? "Max" : isPro ? "Pro" : "Starter";

  return (
    <div className="cfg-row-2" style={{ alignItems: "stretch" }}>
      <div className="cfg-plan-card">
        <div className="cfg-plan-card__lbl">Plano atual</div>
        <div className="cfg-plan-card__name">Plano {planName}</div>
        <div className="cfg-plan-card__price">
          <strong>R$ {planPrice}</strong>/mês · cobrança recorrente
        </div>
        <div className="cfg-plan-card__feats">
          {features.map(f => (
            <span key={f.label} style={{ opacity: f.included ? 1 : 0.5 }}>
              {f.included ? <Check size={14} /> : <X size={14} />}
              {f.label}
            </span>
          ))}
        </div>
        <div className="cfg-plan-card__cta">
          <button type="button" className="btn cfg-btn-dark">Histórico</button>
          {!isMax && (
            <button
              type="button"
              className="btn btn-amber"
              onClick={async () => {
                try {
                  const res = await apiFetch<{ checkoutUrl?: string }>("/api/subscription/checkout", {
                    method: "POST",
                    body: JSON.stringify({ planSlug: isPro ? "max" : "pro" })
                  });
                  if (res.checkoutUrl) window.location.href = res.checkoutUrl;
                } catch {
                  alert("Erro ao iniciar upgrade. Tente novamente.");
                }
              }}
            >
              {isPro ? "Upgrade para Max" : "Upgrade para Pro"}
            </button>
          )}
        </div>
      </div>

      <UsersCard />
    </div>
  );
}

function UsersCard() {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let mounted = true;
    apiFetch<{ users: ApiUser[] }>("/api/users")
      .then(r => { if (mounted) setUsers(r.users); })
      .catch((e: Error) => { if (mounted) setErr(e.message); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  return (
    <SectionCard
      icon={<Users size={18} />}
      iconBg="var(--info-light)"
      iconColor="var(--info)"
      title="Usuários"
      description={
        loading
          ? "Carregando..."
          : `${users.length} ${users.length === 1 ? "pessoa" : "pessoas"} com acesso ao painel`
      }
      action={
        <button type="button" className="btn btn-ghost btn-sm" disabled title="Em breve">
          <Plus size={13} /> Convidar
        </button>
      }
    >
      {err ? <div className="error-box">{err}</div> : null}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
          <div className="loading-spinner" />
        </div>
      ) : users.length === 0 ? (
        <div className="empty">Nenhum usuário cadastrado.</div>
      ) : (
        <div className="cfg-members">
          {users.map(u => {
            const role = classifyRole(u.role.name);
            const colorIdx = avatarColorIndex(u.user.id);
            return (
              <div key={u.id} className="cfg-member">
                <span className={`avatar avatar--md av-${colorIdx}`}>
                  {initials(u.user.name)}
                </span>
                <div>
                  <div className="cfg-member__nm">{u.user.name}</div>
                  <div className="cfg-member__email">{u.user.email}</div>
                </div>
                <span className={`cfg-member__role cfg-member__role--${role}`}>
                  {roleLabel(role)}
                </span>
                <button type="button" className="cfg-row-btn" aria-label="Mais opções">
                  ⋯
                </button>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

/* ─── Notificações ────────────────────────────────── */

function NotificationsSection({
  notifications,
  setNotifications
}: {
  notifications: Record<NotificationKey, boolean>;
  setNotifications: (next: Record<NotificationKey, boolean>) => void;
}) {
  return (
    <SectionCard
      icon={<Bell size={18} />}
      iconBg="#ede9fe"
      iconColor="#7c3aed"
      title="Notificações da equipe"
      description="O que avisar para o dono e gerentes."
    >
      {NOTIFICATION_DEFS.map(n => (
        <div key={n.key} className="cfg-toggle-row">
          <div className="cfg-toggle-row__main">
            <h4>{n.title}</h4>
            <p>{n.desc}</p>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={notifications[n.key]}
              onChange={e => setNotifications({ ...notifications, [n.key]: e.target.checked })}
            />
            <span className="switch__track" />
          </label>
        </div>
      ))}
    </SectionCard>
  );
}

/* ─── Integrações ─────────────────────────────────── */

type IntegStatus = "active" | "inactive" | "configure";

function IntegrationsSection({
  builtIn,
  botEnabled,
  publicBookingEnabled
}: {
  builtIn: Integrations;
  botEnabled: boolean;
  publicBookingEnabled: boolean;
}) {
  const [thirdParty, setThirdParty] = useState<ThirdPartyIntegration[]>([]);

  useEffect(() => {
    apiFetch<{ integrations: ThirdPartyIntegration[] }>("/api/integrations")
      .then(r => setThirdParty(r.integrations))
      .catch(() => {});
  }, []);

  const nfeioActive =
    builtIn.invoice.hasNfeioKey || !!thirdParty.find(i => i.type === "nfeio" && i.isActive);

  const items: {
    id: string;
    name: string;
    desc: string;
    logo: { bg: string; content: React.ReactNode };
    status: IntegStatus;
    href?: string;
  }[] = [
    {
      id: "whatsapp",
      name: "WhatsApp (Evolution)",
      desc: botEnabled && builtIn.bot.hasInstance
        ? "Bot conectado e respondendo"
        : "Bot + lembretes pelo WhatsApp",
      logo: { bg: "#25d366", content: <MessageCircle size={20} /> },
      status: botEnabled && builtIn.bot.hasInstance ? "active" : "inactive",
      href: "/configuracoes/bot"
    },
    {
      id: "nfe",
      name: "NFE.io",
      desc: nfeioActive ? "Emissão automática de NFS-e" : "Conecte para emitir notas fiscais",
      logo: { bg: "linear-gradient(135deg, #0a73e7, #054aaa)", content: "NF" },
      status: nfeioActive ? "active" : "configure",
      href: "/notas-fiscais"
    },
    {
      id: "public-booking",
      name: "Link público",
      desc: publicBookingEnabled
        ? "Clientes podem agendar pelo link"
        : "Página pública desligada",
      logo: { bg: "linear-gradient(135deg, #0d9488, #0f766e)", content: <Calendar size={20} /> },
      status: publicBookingEnabled ? "active" : "configure",
      href: "/link-agenda"
    }
  ];

  return (
    <SectionCard
      icon={<Share2 size={18} />}
      iconBg="var(--success-light)"
      iconColor="var(--success)"
      title="Integrações"
      description="Conecte com WhatsApp, NFE.io, Mercado Pago e mais."
    >
      <div className="cfg-integ-grid">
        {items.map(integ => {
          const label =
            integ.status === "active"
              ? "Ativo"
              : integ.status === "configure"
                ? "Configurar"
                : "Conectar";
          const statusCls = integ.status === "active" ? "cfg-integ__st--on" : "cfg-integ__st--off";
          const Action = (
            <span className={`cfg-integ__st ${statusCls}`}>
              {label}
              {integ.status !== "active" && integ.href ? (
                <ExternalLink size={11} style={{ marginLeft: 4 }} />
              ) : null}
            </span>
          );
          return (
            <div key={integ.id} className="cfg-integ">
              <span className="cfg-integ__logo" style={{ background: integ.logo.bg }}>
                {integ.logo.content}
              </span>
              <div className="cfg-integ__col">
                <div className="cfg-integ__nm">{integ.name}</div>
                <div className="cfg-integ__d">{integ.desc}</div>
              </div>
              {integ.href && integ.status !== "active" ? (
                <Link href={integ.href} style={{ textDecoration: "none" }}>
                  {Action}
                </Link>
              ) : (
                Action
              )}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

/* ─── Zona de risco ───────────────────────────────── */

type DangerAction = "export" | "pause" | "delete";

function DangerZone({ companyName, adminEmail }: { companyName: string; adminEmail: string }) {
  const [pendingAction, setPendingAction] = useState<DangerAction | null>(null);
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const ACTIONS: Record<DangerAction, { label: string; btnLabel: string; btnClass: string; icon: React.ReactNode; desc: string }> = {
    export: {
      label: "Exportar dados",
      btnLabel: "Exportar",
      btnClass: "btn-ghost",
      icon: <Download size={14} />,
      desc: "Baixe um arquivo com todos os seus dados."
    },
    pause: {
      label: "Pausar conta",
      btnLabel: "Pausar",
      btnClass: "cfg-btn-danger",
      icon: <Pause size={14} />,
      desc: "Suspende o acesso temporariamente. Dados preservados por 90 dias."
    },
    delete: {
      label: `Excluir ${companyName} permanentemente`,
      btnLabel: "Excluir empresa",
      btnClass: "cfg-btn-danger-solid",
      icon: <Trash2 size={14} />,
      desc: "Apaga todos os dados desta empresa. Não pode ser desfeito."
    }
  };

  function openModal(action: DangerAction) {
    setPendingAction(action);
    setCode("");
    setCodeSent(false);
    setSentEmail("");
    setError("");
  }

  function closeModal() {
    setPendingAction(null);
    setCode("");
    setCodeSent(false);
    setError("");
  }

  async function requestCode() {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch<{ sent: boolean; email: string }>("/api/auth/send-danger-otp", { method: "POST" });
      setCodeSent(true);
      setSentEmail(res.email);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao enviar código.");
    } finally {
      setLoading(false);
    }
  }

  async function confirmAction() {
    if (!pendingAction) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch<{ done: boolean; redirectTo?: string; scheduled?: boolean }>(
        "/api/company/danger-action",
        { method: "POST", body: JSON.stringify({ action: pendingAction, code }) }
      );
      if (res.redirectTo) {
        window.location.href = res.redirectTo;
        return;
      }
      if (res.scheduled) {
        alert("Exportação solicitada! Você receberá um e-mail em breve.");
      }
      closeModal();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Código inválido ou expirado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="cfg-danger-zone">
      <h3>
        <AlertTriangle size={16} />
        Zona de risco
      </h3>
      <p>
        Ações irreversíveis. Um código de verificação será enviado para <strong>{adminEmail}</strong>.
      </p>

      {(Object.keys(ACTIONS) as DangerAction[]).map(action => (
        <div key={action} className="cfg-danger-zone__row">
          <div className="info">
            <h4>{ACTIONS[action].label}</h4>
            <p>{ACTIONS[action].desc}</p>
          </div>
          <button type="button" className={`btn ${ACTIONS[action].btnClass}`} onClick={() => openModal(action)}>
            {ACTIONS[action].icon} {ACTIONS[action].btnLabel}
          </button>
        </div>
      ))}

      {pendingAction && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Confirmar: {ACTIONS[pendingAction].label}</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={closeModal} aria-label="Fechar">
                <X size={16} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {!codeSent ? (
                <>
                  <p style={{ fontSize: 14, color: "var(--muted)", margin: 0 }}>
                    Enviaremos um código de verificação para <strong>{adminEmail}</strong>.
                  </p>
                  {error ? <div className="error-box">{error}</div> : null}
                  <button type="button" className="btn btn-primary" onClick={requestCode} disabled={loading}>
                    {loading ? "Enviando..." : "Enviar código de verificação"}
                  </button>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 14, color: "var(--muted)", margin: 0 }}>
                    Código enviado para <strong>{sentEmail}</strong>. Válido por 10 minutos.
                  </p>
                  <div className="cfg-field">
                    <input
                      value={code}
                      onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000"
                      maxLength={6}
                      inputMode="numeric"
                      autoFocus
                      style={{ fontSize: 22, letterSpacing: 8, textAlign: "center" }}
                    />
                  </div>
                  {error ? <div className="error-box">{error}</div> : null}
                  <button
                    type="button"
                    className={`btn ${ACTIONS[pendingAction].btnClass}`}
                    onClick={confirmAction}
                    disabled={code.length < 6 || loading}
                  >
                    {loading ? "Confirmando..." : `Confirmar ${ACTIONS[pendingAction].label}`}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={requestCode} disabled={loading}>
                    Reenviar código
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Placeholder genérico ────────────────────────── */

const COMING_SOON_LABELS: Record<string, { title: string; desc: string }> = {
  permissions: {
    title: "Perfis e permissões",
    desc: "Crie perfis customizados (Recepção, Caixa, Profissional) com permissões granulares."
  },
  appearance: {
    title: "Aparência",
    desc: "Defina cores, logo e identidade visual da página pública e dos e-mails."
  },
  "custom-fields": {
    title: "Campos personalizados",
    desc: "Adicione campos extras em clientes, agendamentos e profissionais."
  },
  api: {
    title: "API e webhooks",
    desc: "Gere chaves de API e configure webhooks para integrar com seu sistema."
  },
  logs: {
    title: "Logs de atividade",
    desc: "Auditoria completa de ações de usuários, acessos e alterações sensíveis."
  },
  me: {
    title: "Meu perfil",
    desc: "Atualize seu nome, foto, e-mail e preferências pessoais de notificação."
  }
};

function ComingSoon({ sectionKey }: { sectionKey: string }) {
  const meta = COMING_SOON_LABELS[sectionKey] ?? {
    title: "Em breve",
    desc: "Esta seção está em desenvolvimento."
  };
  return (
    <div className="cfg-empty">
      <span className="cfg-empty__ico">
        <Building2 size={20} />
      </span>
      <h4>{meta.title}</h4>
      <p>{meta.desc}</p>
    </div>
  );
}
