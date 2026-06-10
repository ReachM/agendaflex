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

type Session = {
  kind: "super_admin" | "tenant";
  user: { id: string; name: string; email: string };
  role: string;
  company: null | { id: string; name: string; segment: string; status: string; plan: string; slug?: string; publicBookingEnabled?: boolean };
  planFeatures?: Record<string, boolean>;
  menuItems?: { href: string; label: string; icon: string; section?: string; requiredPlan?: "pro" | "max" }[];
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
  const links = useMemo(() => {
    if (!session) return [];
    return (session.menuItems ?? []).map((item) => ({
      ...item,
      icon: iconMap[item.icon] ?? LayoutDashboard,
      locked: !canAccess(item.requiredPlan, planSlug)
    }));
  }, [session, planSlug]);

  const menuGroups = useMemo(() => groupMenuItems(links), [links]);
  const pageTitle = useMemo(() => getPageTitle(pathname, links), [pathname, links]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
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
              <button className="upgrade-card__btn" type="button">
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
            <button
              type="button"
              aria-label="Ajuda"
              title="Ajuda"
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
          {showTrialBanner && <TrialBanner daysLeft={subscription!.trialDaysLeft} />}
          {children}
        </div>
      </main>

      {showBlockingModal && <TrialExpiredModal />}
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
