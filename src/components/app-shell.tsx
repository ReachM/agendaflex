"use client";

import {
  Activity,
  Building2,
  CalendarDays,
  ClipboardList,
  FileClock,
  LayoutDashboard,
  LogOut,
  Settings,
  SlidersHorizontal,
  Stethoscope,
  UserCog,
  Users
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState } from "react";

type Session = {
  kind: "super_admin" | "tenant";
  user: { id: string; name: string; email: string };
  role: string;
  company: null | { id: string; name: string; segment: string; status: string; plan: string };
};

const tenantLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/servicos", label: "Serviços", icon: ClipboardList },
  { href: "/profissionais", label: "Profissionais", icon: Stethoscope },
  { href: "/campos-personalizados", label: "Campos", icon: SlidersHorizontal },
  { href: "/usuarios", label: "Usuários", icon: UserCog },
  { href: "/relatorios", label: "Relatórios", icon: Activity },
  { href: "/logs", label: "Logs", icon: FileClock },
  { href: "/configuracoes", label: "Configurações", icon: Settings }
];

const masterLinks = [
  { href: "/master", label: "Master", icon: LayoutDashboard },
  { href: "/master/empresas", label: "Empresas", icon: Building2 },
  { href: "/logs", label: "Logs", icon: FileClock }
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me")
      .then(async (response) => {
        if (!response.ok) throw new Error("unauthorized");
        return response.json();
      })
      .then((data) => {
        if (active) setSession(data);
      })
      .catch(() => router.push("/login"))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [router]);

  const links = useMemo(() => {
    if (session?.kind === "super_admin") return masterLinks;
    return tenantLinks;
  }, [session]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  if (loading) {
    return <main className="content">Carregando...</main>;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand-mark">AF</div>
          <div>
            <strong>AgendaFlex</strong>
            <span>{session?.company?.name ?? "Painel Master"}</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="Principal">
          {links.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link className={`nav-link ${active ? "active" : ""}`} href={item.href} key={item.href}>
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <strong>{session?.user.name}</strong>
            <span>{session?.role}</span>
          </div>
          <button className="button secondary" onClick={logout} type="button">
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
