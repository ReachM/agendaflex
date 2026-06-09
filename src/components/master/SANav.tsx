"use client";

import {
  Activity,
  Building2,
  Cpu,
  DollarSign,
  FileText,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Shield,
  Tag,
  ToggleLeft,
  Users,
  type LucideIcon
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export type SANavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  alert?: number;
};

export const SA_NAV: { group: string; items: SANavItem[] }[] = [
  {
    group: "PLATAFORMA",
    items: [
      { href: "/master/overview", label: "Visão geral", icon: LayoutDashboard },
      { href: "/master/empresas", label: "Empresas", icon: Building2 },
      { href: "/master/usuarios", label: "Usuários", icon: Users },
      { href: "/master/assinaturas", label: "Assinaturas & MRR", icon: DollarSign }
    ]
  },
  {
    group: "OPERAÇÃO",
    items: [
      { href: "/master/saude", label: "Saúde do sistema", icon: Activity, alert: 2 },
      { href: "/master/whatsapp", label: "Instâncias WhatsApp", icon: MessageCircle },
      { href: "/master/notas-fiscais", label: "Notas fiscais", icon: FileText },
      { href: "/master/filas", label: "Filas & jobs", icon: Cpu }
    ]
  },
  {
    group: "CONFIGURAÇÃO",
    items: [
      { href: "/master/planos", label: "Planos & preços", icon: Tag },
      { href: "/master/feature-flags", label: "Feature flags", icon: ToggleLeft },
      { href: "/master/logs", label: "Logs & auditoria", icon: Shield }
    ]
  }
];

export function findNavLabel(pathname: string): string {
  for (const group of SA_NAV) {
    const match = group.items.find((item) => pathname.startsWith(item.href));
    if (match) return match.label;
  }
  return "Super Admin";
}

export function SANav({
  user,
  onNavigate
}: {
  user: { name: string; email: string };
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const initials = user.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <div className="sa-side__logo">
        <span className="sa-logo-text">MarcaiFlex</span>
        <span className="badge">Admin</span>
      </div>

      <nav style={{ flex: 1 }}>
        {SA_NAV.map((group) => (
          <div key={group.group}>
            <div className="sa-side__group">{group.group}</div>
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sa-nav-item ${active ? "is-active" : ""}`}
                  onClick={onNavigate}
                >
                  <Icon size={17} />
                  <span>{item.label}</span>
                  {item.alert ? <span className="badge-count">{item.alert}</span> : null}
                  {item.badge ? <span className="badge-num">{item.badge.toLocaleString("pt-BR")}</span> : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sa-side__foot">
        <div className="sa-user">
          <span className="sa-user__avt">{initials}</span>
          <div style={{ minWidth: 0 }}>
            <div className="nm">{user.name}</div>
            <div className="role">Super Admin</div>
          </div>
        </div>
        <button type="button" className="sa-logout" onClick={logout}>
          <LogOut size={14} /> Sair
        </button>
      </div>
    </>
  );
}
