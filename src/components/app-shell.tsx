"use client";

import {
  Activity,
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

type Session = {
  kind: "super_admin" | "tenant";
  user: { id: string; name: string; email: string };
  role: string;
  company: null | { id: string; name: string; segment: string; status: string; plan: string; slug?: string; publicBookingEnabled?: boolean };
  planFeatures?: Record<string, boolean>;
  menuItems?: { href: string; label: string; icon: string }[];
};

const iconMap: Record<string, any> = {
  LayoutDashboard, CalendarDays, Users, ClipboardList, Briefcase,
  SlidersHorizontal, UserCog, DollarSign, FileText, CheckSquare,
  Activity, FileClock, Settings, Building2, CreditCard, Link2
};

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  COMPANY_ADMIN: "Administrador",
  MANAGER: "Gerente",
  STAFF: "Atendente",
  USER: "Usuário"
};

const planBadgeColors: Record<string, string> = {
  starter: "plan-badge--starter",
  pro: "plan-badge--pro",
  max: "plan-badge--max"
};

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

  return (
    <div className="app-shell">
      {/* Mobile toggle */}
      <button
        className="mobile-menu-toggle"
        onClick={() => setMobileOpen(!mobileOpen)}
        type="button"
        aria-label="Menu"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <div className="brand-mark">AF</div>
          <div>
            <strong>AgendaFlex</strong>
            <span>{session?.company?.name ?? "Painel Master"}</span>
          </div>
        </div>

        {session?.company && (
          <div className={`plan-badge ${planBadgeColors[planSlug] ?? ""}`}>
            Plano {planSlug.charAt(0).toUpperCase() + planSlug.slice(1)}
          </div>
        )}

        <nav className="nav-list" aria-label="Principal">
          {links.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href !== "/dashboard" && item.href !== "/master" && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                className={`nav-link ${active ? "active" : ""}`}
                href={item.href}
                key={item.href}
                onClick={() => setMobileOpen(false)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <strong>{session?.user.name}</strong>
            <span>{roleLabels[session?.role ?? ""] ?? session?.role}</span>
          </div>
          <button className="button secondary" onClick={logout} type="button">
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </aside>

      {mobileOpen && <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />}

      <main className="content">{children}</main>
    </div>
  );
}
