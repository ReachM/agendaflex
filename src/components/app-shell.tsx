"use client";

import {
  Activity,
  ArrowRight,
  Bot,
  Briefcase,
  Building2,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  CreditCard,
  DollarSign,
  FileClock,
  FileText,
  LayoutDashboard,
  Link2,
  LogOut,
  type LucideIcon,
  Menu,
  Settings,
  SlidersHorizontal,
  UserCog,
  Users,
  X
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { TrialBanner, TrialExpiredModal, type SubscriptionState } from "@/components/subscription-gate";
import { Mark } from "@/components/brand/Mark";
import { Wordmark } from "@/components/brand/Wordmark";

type Session = {
  kind: "super_admin" | "tenant";
  user: { id: string; name: string; email: string };
  role: string;
  company: null | { id: string; name: string; segment: string; status: string; plan: string; slug?: string; publicBookingEnabled?: boolean };
  planFeatures?: Record<string, boolean>;
  menuItems?: { href: string; label: string; icon: string; section?: string }[];
  subscription?: SubscriptionState | null;
};

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard, CalendarDays, Users, ClipboardList, Briefcase,
  SlidersHorizontal, UserCog, DollarSign, FileText, CheckSquare,
  Activity, FileClock, Settings, Building2, CreditCard, Link2, Bot
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

/** Agrupa os itens do menu por seção para renderizar os labels de seção no sidebar */
function groupMenuItems<T extends MenuItemBase>(items: T[] | undefined) {
  if (!items) return [];

  // Definir seções baseadas no href
  const sectionMap: Record<string, string> = {
    "/dashboard": "Operação",
    "/agenda": "Operação",
    "/clientes": "Operação",
    "/profissionais": "Operação",
    "/servicos": "Operação",
    "/link-agenda": "Operação",
    "/financeiro": "Financeiro",
    "/notas-fiscais": "Financeiro",
    "/relatorios": "Financeiro",
    "/checklists": "Configuração",
    "/configuracoes/bot": "Configuração",
    "/configuracoes": "Configuração",
    "/usuarios": "Configuração",
    "/logs": "Configuração",
    // Master
    "/master": "Master",
    "/master/empresas": "Master",
    "/master/planos": "Master",
    "/master/campos": "Master",
  };

  const groups: { section: string; items: T[] }[] = [];
  let lastSection = "";

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

  const links = useMemo(() => {
    if (!session) return [];
    return (session.menuItems ?? []).map((item) => ({
      ...item,
      icon: iconMap[item.icon] ?? LayoutDashboard
    }));
  }, [session]);

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

  const planSlug = session?.company?.plan ?? "starter";
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
                  ? "Agendamento online, bot WhatsApp e muito mais."
                  : "Módulo Financeiro completo, DRE, notas fiscais e checklists ilimitados."}
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
          <div className="topbar-actions">
            <div className="user-chip">
              <span className="chip-avatar">{userInitials}</span>
              <span className="chip-name">{session?.user.name?.split(" ")[0]}</span>
            </div>
          </div>
        </div>

        {/* Page content */}
        <div className="page-wrapper">
          {showTrialBanner && <TrialBanner daysLeft={subscription!.trialDaysLeft} />}
          {children}
        </div>
      </main>

      {showBlockingModal && <TrialExpiredModal />}
    </div>
  );
}
