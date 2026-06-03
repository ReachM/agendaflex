import type { RoleName } from "@prisma/client";

export const PERMISSIONS = [
  "companies:manage",
  "users:manage",
  "customers:manage",
  "customers:view",
  "services:manage",
  "services:view",
  "professionals:manage",
  "professionals:view",
  "appointments:manage",
  "appointments:view",
  "custom_fields:manage",
  "custom_fields:view",
  "reports:view",
  "reports:advanced",
  "logs:view",
  "settings:manage",
  "financial:view",
  "financial:manage",
  "invoices:manage",
  "checklists:manage",
  "checklists:view",
  "public_booking:manage",
  "clinical_notes:view"
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<RoleName, PermissionKey[]> = {
  SUPER_ADMIN: [...PERMISSIONS],
  COMPANY_ADMIN: [
    "users:manage",
    "customers:manage",
    "customers:view",
    "services:manage",
    "services:view",
    "professionals:manage",
    "professionals:view",
    "appointments:manage",
    "custom_fields:manage",
    "custom_fields:view",
    "reports:view",
    "reports:advanced",
    "logs:view",
    "settings:manage",
    "financial:view",
    "financial:manage",
    "invoices:manage",
    "checklists:manage",
    "checklists:view",
    "public_booking:manage",
    "clinical_notes:view"
  ],
  MANAGER: [
    "customers:manage",
    "customers:view",
    "services:manage",
    "services:view",
    "professionals:manage",
    "professionals:view",
    "appointments:manage",
    "appointments:view",
    "custom_fields:view",
    "reports:view",
    "logs:view",
    "settings:manage",
    "financial:view",
    "checklists:manage",
    "checklists:view"
  ],
  STAFF: [
    "customers:view",
    "customers:manage",
    "services:view",
    "professionals:view",
    "appointments:manage",
    "appointments:view",
    "custom_fields:view",
    "checklists:view"
  ],
  USER: [
    "customers:view",
    "appointments:view"
  ]
};

// Menu items visible per role
export type MenuItem = {
  href: string;
  label: string;
  icon: string;
  section?: string;
  permission?: PermissionKey;
  /** Minimum plan required to access (item stays visible but locked when not met) */
  requiredPlan?: "pro" | "max";
};

export const TENANT_MENU_ITEMS: MenuItem[] = [
  // ── OPERAÇÃO ──────────────────────────────────────
  { section: "Operação", href: "/dashboard",      label: "Dashboard",            icon: "LayoutDashboard" },
  { section: "Operação", href: "/agenda",         label: "Agenda",               icon: "CalendarDays",       permission: "appointments:manage" },
  { section: "Operação", href: "/clientes",       label: "Clientes",             icon: "Users",              permission: "customers:view" },
  { section: "Operação", href: "/profissionais",  label: "Profissionais",        icon: "Briefcase",          permission: "professionals:view" },
  { section: "Operação", href: "/servicos",       label: "Serviços",             icon: "ClipboardList",      permission: "services:view" },
  { section: "Operação", href: "/link-agenda",    label: "Link de Agendamento",  icon: "Link2",              permission: "public_booking:manage" },

  // ── CONFIGURAÇÃO (parte 1) ────────────────────────
  { section: "Configuração", href: "/campos-personalizados", label: "Campos Personalizados", icon: "SlidersHorizontal", permission: "custom_fields:manage" },
  { section: "Configuração", href: "/usuarios",              label: "Usuários",              icon: "UserCog",           permission: "users:manage" },

  // ── FINANCEIRO ────────────────────────────────────
  { section: "Financeiro", href: "/financeiro",    label: "Financeiro",    icon: "DollarSign", permission: "financial:view",   requiredPlan: "pro" },
  { section: "Financeiro", href: "/notas-fiscais", label: "Notas Fiscais", icon: "FileText",   permission: "invoices:manage",  requiredPlan: "pro" },
  { section: "Financeiro", href: "/relatorios",    label: "Relatórios",    icon: "Activity",   permission: "reports:view",     requiredPlan: "pro" },

  // ── CONFIGURAÇÃO (parte 2) ────────────────────────
  { section: "Configuração", href: "/checklists",        label: "Checklists",    icon: "CheckSquare", permission: "checklists:view" },
  { section: "Configuração", href: "/configuracoes",     label: "Configurações", icon: "Settings",    permission: "settings:manage" },
  { section: "Configuração", href: "/logs",              label: "Logs",          icon: "FileClock",   permission: "logs:view" },
  { section: "Configuração", href: "/configuracoes/bot", label: "Bot WhatsApp",  icon: "Bot",         permission: "settings:manage", requiredPlan: "max" }
];

export const MASTER_MENU_ITEMS: MenuItem[] = [
  { href: "/master", label: "Visão geral", icon: "LayoutDashboard" },
  { href: "/master/empresas", label: "Empresas", icon: "Building2" },
  { href: "/master/usuarios", label: "Usuários", icon: "Users" },
  { href: "/master/assinaturas", label: "Assinaturas & MRR", icon: "CreditCard" },
  { href: "/master/saude", label: "Saúde do sistema", icon: "Activity" },
  { href: "/master/instancias", label: "Instâncias WhatsApp", icon: "Bot" },
  { href: "/master/notas-fiscais", label: "Notas fiscais", icon: "FileText" },
  { href: "/master/filas", label: "Filas & jobs", icon: "Clock" },
  { href: "/master/planos", label: "Planos & preços", icon: "DollarSign" },
  { href: "/master/feature-flags", label: "Feature flags", icon: "ToggleLeft" },
  { href: "/master/campos", label: "Campos personalizados", icon: "SlidersHorizontal" },
  { href: "/logs", label: "Logs & auditoria", icon: "FileClock" }
];

export function hasPermission(roleName: RoleName, permission: PermissionKey) {
  return ROLE_PERMISSIONS[roleName].includes(permission);
}

/**
 * Returns menu items the user is allowed to *see* (role-based filter only).
 * Plan-gated items are NOT filtered out — they stay visible and are rendered
 * as locked (cadeado) by the sidebar based on `requiredPlan` vs. the
 * user's current plan slug.
 */
export function getVisibleMenuItems(
  roleName: RoleName,
  _planFeatures?: Record<string, boolean>
): MenuItem[] {
  return TENANT_MENU_ITEMS.filter((item) => {
    if (!item.permission) return true;
    return hasPermission(roleName, item.permission);
  });
}
