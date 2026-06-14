"use client";

import {
  Activity,
  ArrowRight,
  Bell,
  Bot,
  Briefcase,
  Building2,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  Clock,
  CreditCard,
  DollarSign,
  FileClock,
  FileText,
  HelpCircle,
  LayoutDashboard,
  Link2,
  Lock,
  LogOut,
  type LucideIcon,
  Menu,
  Search,
  Settings,
  SlidersHorizontal,
  ToggleLeft,
  UserCog,
  Users,
  X
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { TrialBanner, TrialExpiredModal, type SubscriptionState } from "@/components/subscription-gate";
import { GlobalSearch } from "@/components/global-search";
import { ImpersonateBanner } from "@/components/impersonate-banner";
import { Mark } from "@/components/brand/Mark";
import { Wordmark } from "@/components/brand/Wordmark";
import { apiFetch } from "@/lib/client-api";

type Session = {
  kind: "super_admin" | "tenant";
  user: { id: string; name: string; email: string };
  role: string;
  company: null | { id: string; name: string; segment: string; status: string; plan: string; slug?: string; publicBookingEnabled?: boolean };
  planFeatures?: Record<string, boolean>;
  menuItems?: { href: string; label: string; icon: string; section?: string; requiredPlan?: "pro" | "max"; featureFlag?: string }[];
  subscription?: SubscriptionState | null;
};

const PLAN_ORDER: Record<string, number> = { starter: 0, pro: 1, max: 2 };
const PLAN_DISPLAY: Record<string, string> = { pro: "Pro", max: "Max" };

function canAccess(required: "pro" | "max" | undefined, plan: string): boolean {
  if (!required) return true;
  return (PLAN_ORDER[plan] ?? 0) >= (PLAN_ORDER[required] ?? 0);
}

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard, CalendarDays, Users, ClipboardList, Briefcase,
  SlidersHorizontal, UserCog, DollarSign, FileText, CheckSquare,
  Activity, FileClock, Settings, Building2, CreditCard, Link2, Bot,
  Clock, ToggleLeft, HelpCircle, Bell, Search
};

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  COMPANY_ADMIN: "Administrador",
  MANAGER: "Gerente",
  STAFF: "Atendente",
  USER: "Usuário"
};

const planLabels: Record<string, string> = {
  starter: "Plano Starter",
  pro: "Plano Pro",
  max: "Plano Max"
};

type MenuItemBase = { href: string; label: string; section?: string };

/**
 * Agrupa itens consecutivos com a mesma seção em blocos.
 * Uma seção pode aparecer mais de uma vez se houver outra seção no meio
 * (ex: Configuração → Financeiro → Configuração) — cada bloco renderiza
 * sua própria label, mas itens consecutivos compartilham uma única label.
 */
function groupMenuItems<T extends MenuItemBase>(items: T[] | undefined) {
  if (!items) return [];

  const sectionMap: Record<string, string> = {
    // Master
    "/master": "Visão geral",
    "/master/empresas": "Tenants",
    "/master/usuarios": "Tenants",
    "/master/assinaturas": "Receita",
    "/master/planos": "Receita",
    "/master/saude": "Operação",
    "/master/instancias": "Operação",
    "/master/filas": "Operação",
    "/master/notas-fiscais": "Operação",
    "/master/feature-flags": "Plataforma",
    "/master/configuracoes": "Plataforma",
    "/master/campos": "Plataforma"
  };

  const groups: { section: string; items: T[] }[] = [];
  let lastSection: string | null = null;

  for (const item of items) {
    const section = item.section ?? sectionMap[item.href] ?? "";
    if (section !== lastSection) {
      groups.push({ section, items: [item] });
      lastSection = section;
    } else {
      groups[groups.length - 1].items.push(item);
    }
  }

  return groups;
}

/** Extrai as iniciais do nome para avatares */
function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/** Identifica o título da página atual para o breadcrumb */
function getPageTitle<T extends MenuItemBase>(pathname: string, menuItems?: T[]): string {
  const item = menuItems?.find((m) => pathname === m.href || (m.href !== "/dashboard" && m.href !== "/master" && pathname.startsWith(`${m.href}/`)));
  return item?.label ?? "Painel";
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [support, setSupport] = useState<{ whatsapp: string | null; message: string } | null>(null);
  const [maintenance, setMaintenance] = useState<{ enabled: boolean; message: string } | null>(null);
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [announcement, setAnnouncement] = useState<{
    message: string;
    type: "info" | "warning" | "success";
    active: boolean;
  } | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me")
      .then(async (response) => {
        if (!response.ok) throw new Error("unauthorized");
        return response.json();
      })
      .then((data) => { if (active) setSession(data); })
      .catch(() => router.push("/login"))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [router]);

  // WhatsApp de suporte (público) + modo manutenção (público) — exibidos para
  // qualquer usuário logado no painel.
  useEffect(() => {
    fetch("/api/public/support")
      .then((r) => r.json())
      .then((d) => setSupport(d))
      .catch(() => {});
    fetch("/api/public/maintenance")
      .then((r) => r.json())
      .then((d) => setMaintenance(d))
      .catch(() => {});
  }, []);

  // Aviso global — só faz sentido para usuários de empresa (tenant).
  useEffect(() => {
    if (session?.kind !== "tenant") return;
    fetch("/api/announcement")
      .then((r) => r.json())
      .then((d) => setAnnouncement(d))
      .catch(() => {});
  }, [session?.kind]);

  // Feature flags do painel empresa — itens do menu somem quando a feature
  // estiver desativada pelo super admin. Fail-open: erro mantém tudo visível.
  useEffect(() => {
    if (session?.kind !== "tenant") return;
    fetch("/api/feature-flags")
      .then((r) => r.json())
      .then((d) => setFeatures(d.features ?? {}))
      .catch(() => {});
  }, [session?.kind]);

  // Esc fecha o drawer da sidebar no mobile
  useEffect(() => {
    if (!mobileOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const planSlug = session?.company?.plan ?? "starter";
  // Default: ativa, a menos que explicitamente desativada (false).
  const isFeatureEnabled = (key?: string) => !key || features[key] !== false;
  const links = useMemo(() => {
    if (!session) return [];
    return (session.menuItems ?? [])
      .filter((item) => isFeatureEnabled(item.featureFlag))
      .map((item) => ({
        ...item,
        icon: iconMap[item.icon] ?? LayoutDashboard,
        locked: !canAccess(item.requiredPlan, planSlug)
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, planSlug, features]);

  const menuGroups = useMemo(() => groupMenuItems(links), [links]);
  const pageTitle = useMemo(() => getPageTitle(pathname, links), [pathname, links]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function startUpgrade(targetSlug: "pro" | "max") {
    try {
      const res = await apiFetch<{ checkoutUrl?: string }>("/api/subscription/checkout", {
        method: "POST",
        body: JSON.stringify({ planSlug: targetSlug })
      });
      if (res.checkoutUrl) window.location.href = res.checkoutUrl;
    } catch {
      alert("Erro ao iniciar upgrade. Tente novamente.");
    }
  }

  if (loading) {
    return (
      <main className="content" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div className="loading-spinner" />
      </main>
    );
  }

  const subscription = session?.subscription ?? null;
  const showTrialBanner = subscription?.isTrial && !subscription.isBlocked;
  const showBlockingModal = subscription?.isBlocked ?? false;
  const isMaster = session?.kind === "super_admin";
  const companyName = session?.company?.name ?? (isMaster ? "MarcaiFlex Platform" : "Painel Master");
  const companyInitials = getInitials(companyName);
  const userInitials = getInitials(session?.user.name ?? "U");
  const showUpgradeCard = !isMaster && session?.company && planSlug !== "max";

  return (
    <div className={`app-shell ${isMaster ? "master-shell" : ""}`}>
      {/* Mobile toggle */}
      <button
        className="mobile-menu-toggle"
        onClick={() => setMobileOpen(!mobileOpen)}
        type="button"
        aria-label="Menu"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside className={`sidebar ${mobileOpen ? "open" : ""}`} aria-label="Navegação principal">
        {/* Brand */}
        <div className="sidebar-header">
          <Mark size="md" />
          <Wordmark variant="light" size="md" />
          {isMaster ? <span className="master-tag">MASTER</span> : null}
        </div>

        {/* Tenant Card */}
        {session?.company && (
          <div className="sidebar-tenant">
            <span className="tenant-avatar">{companyInitials}</span>
            <div className="tenant-info">
              <span className="tenant-name">{companyName}</span>
              <span className="tenant-plan">{planLabels[planSlug] ?? planSlug}</span>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="nav-list" aria-label="Principal">
          {menuGroups.map((group, groupIndex) => (
            <div key={groupIndex}>
              {group.section && (
                <div className="nav-section-label">{group.section}</div>
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || (item.href !== "/dashboard" && item.href !== "/master" && pathname.startsWith(`${item.href}/`));
                if (item.locked) {
                  const required = item.requiredPlan ? PLAN_DISPLAY[item.requiredPlan] ?? item.requiredPlan : "";
                  return (
                    <div
                      key={item.href}
                      className="nav-link nav-link--locked"
                      title={required ? `Disponível no plano ${required}` : "Indisponível no seu plano"}
                      aria-disabled="true"
                    >
                      <Icon size={17} />
                      <span>{item.label}</span>
                      <Lock size={12} className="nav-link__lock" aria-label="Bloqueado" />
                    </div>
                  );
                }
                return (
                  <Link
                    className={`nav-link ${active ? "active" : ""}`}
                    href={item.href}
                    key={item.href}
                    onClick={() => setMobileOpen(false)}
                  >
                    <Icon size={17} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          {/* Upgrade Card (hidden for Max plan) */}
          {showUpgradeCard && (
            <div className="upgrade-card">
              <div className="upgrade-card__title">
                {planSlug === "starter" ? "Desbloqueie o Pro" : "Desbloqueie o Max"}
              </div>
              <div className="upgrade-card__desc">
                {planSlug === "starter"
                  ? "Financeiro completo, DRE, Notas Fiscais e Relatórios avançados."
                  : "Bot WhatsApp com lembretes automáticos e agendamento conversacional."}
              </div>
              <button
                className="upgrade-card__btn"
                type="button"
                onClick={() => startUpgrade(planSlug === "starter" ? "pro" : "max")}
              >
                Fazer upgrade
                <ArrowRight size={13} />
              </button>
            </div>
          )}

          {/* User info */}
          <div className="sidebar-user">
            <span className="user-avatar">{userInitials}</span>
            <div className="user-info">
              <strong>{session?.user.name}</strong>
              <span>{roleLabels[session?.role ?? ""] ?? session?.role}</span>
            </div>
          </div>

          {/* Logout */}
          <button className="button secondary" onClick={logout} type="button" style={{ width: "100%" }}>
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </aside>

      {mobileOpen && <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />}

      <main className={`content ${showBlockingModal ? "content--blocked" : ""}`}>
        {/* Topbar */}
        <div className="topbar-main">
          <div className="breadcrumb">
            <span className="crumb-hide">{companyName}</span>
            <span className="sep">/</span>
            <span className="now">{pageTitle}</span>
          </div>
          {!isMaster && <GlobalSearch />}
          <div className="topbar-actions">
            <div style={{ position: "relative", display: "inline-flex", flexDirection: "column", alignItems: "center" }}>
              <button
                type="button"
                aria-label="Ajuda"
                title="Ajuda"
                onClick={() => router.push("/ajuda")}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 9,
                  background: "transparent",
                  border: "1px solid transparent",
                  color: "var(--text-secondary)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "all var(--transition)"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--surface-muted)";
                  e.currentTarget.style.borderColor = "var(--border)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.borderColor = "transparent";
                }}
              >
                <HelpCircle size={18} />
              </button>

              {/* Etiqueta fixa saindo por baixo do ícone */}
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "var(--primary)",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  padding: "3px 8px",
                  borderRadius: 99,
                  pointerEvents: "none",
                  letterSpacing: "0.02em",
                  zIndex: 50,
                }}
              >
                Dúvidas?
              </div>
            </div>
            {!isMaster && <NotificationBell />}
            <div className="user-chip">
              <span className="chip-avatar">{userInitials}</span>
              <span className="chip-name">{session?.user.name?.split(" ")[0]}</span>
            </div>
          </div>
        </div>

        {/* Page content */}
        <div className="page-wrapper">
          <ImpersonateBanner />
          {maintenance?.enabled && (
            <div
              style={{
                background: "#fef3c7",
                borderBottom: "1px solid #f59e0b",
                padding: "10px 20px",
                fontSize: 13.5,
                fontWeight: 600,
                color: "#92400e",
                display: "flex",
                alignItems: "center",
                gap: 10
              }}
            >
              🔧 {maintenance.message || "Sistema em manutenção. Algumas funcionalidades podem estar indisponíveis."}
            </div>
          )}
          {announcement?.active && announcement.message && (
            <div className={`announcement-banner announcement-banner--${announcement.type}`}>
              <span>{announcement.message}</span>
              <button onClick={() => setAnnouncement(null)} type="button" aria-label="Fechar">
                ×
              </button>
            </div>
          )}
          {showTrialBanner && <TrialBanner daysLeft={subscription!.trialDaysLeft} />}
          {children}
        </div>
      </main>

      {showBlockingModal && <TrialExpiredModal />}

      {support?.whatsapp && (
        <a
          href={`https://wa.me/${support.whatsapp}?text=${encodeURIComponent(support.message)}`}
          target="_blank"
          rel="noreferrer"
          className="support-fab"
          title="Falar com suporte"
          aria-label="Suporte via WhatsApp"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
        </a>
      )}
    </div>
  );
}

function NotificationBell() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    fetch("/api/notifications/count")
      .then((r) => (r.ok ? r.json() : { count: 0 }))
      .then((data) => {
        if (active) setCount(typeof data?.count === "number" ? data.count : 0);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return (
    <button
      type="button"
      aria-label="Notificações"
      title={count > 0 ? `${count} notificações pendentes` : "Notificações"}
      style={{
        position: "relative",
        width: 38,
        height: 38,
        borderRadius: 9,
        background: "transparent",
        border: "1px solid transparent",
        color: "var(--text-secondary)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "all var(--transition)"
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--surface-muted)";
        e.currentTarget.style.borderColor = "var(--border)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.borderColor = "transparent";
      }}
    >
      <Bell size={18} />
      {count > 0 && (
        <span
          style={{
            position: "absolute",
            top: 8,
            right: 9,
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "var(--danger)",
            boxShadow: "0 0 0 2px #fff"
          }}
        />
      )}
    </button>
  );
}
