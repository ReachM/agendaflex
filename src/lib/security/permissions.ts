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
  "public_booking:manage"
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
    "public_booking:manage"
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
  permission?: PermissionKey;
  planFeature?: string;
};

export const TENANT_MENU_ITEMS: MenuItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/agenda", label: "Agenda", icon: "CalendarDays", permission: "appointments:manage" },
  { href: "/clientes", label: "Clientes", icon: "Users", permission: "customers:view" },
  { href: "/servicos", label: "Serviços", icon: "ClipboardList", permission: "services:view" },
  { href: "/profissionais", label: "Profissionais", icon: "Briefcase", permission: "professionals:view" },
  { href: "/campos-personalizados", label: "Campos Personalizados", icon: "SlidersHorizontal", permission: "custom_fields:manage" },
  { href: "/usuarios", label: "Usuários", icon: "UserCog", permission: "users:manage" },
  { href: "/financeiro", label: "Financeiro", icon: "DollarSign", permission: "financial:view", planFeature: "allowFinancialControl" },
  { href: "/notas-fiscais", label: "Notas Fiscais", icon: "FileText", permission: "invoices:manage", planFeature: "allowInvoiceRequest" },
  { href: "/checklists", label: "Checklists", icon: "CheckSquare", permission: "checklists:manage", planFeature: "allowCustomerChecklist" },
  { href: "/relatorios", label: "Relatórios", icon: "Activity", permission: "reports:view" },
  { href: "/logs", label: "Logs", icon: "FileClock", permission: "logs:view" },
  { href: "/configuracoes", label: "Configurações", icon: "Settings", permission: "settings:manage" }
];

export const MASTER_MENU_ITEMS: MenuItem[] = [
  { href: "/master", label: "Dashboard Master", icon: "LayoutDashboard" },
  { href: "/master/empresas", label: "Empresas", icon: "Building2" },
  { href: "/master/planos", label: "Planos", icon: "CreditCard" },
  { href: "/master/campos", label: "Campos", icon: "SlidersHorizontal" },
  { href: "/logs", label: "Logs Globais", icon: "FileClock" }
];

export function hasPermission(roleName: RoleName, permission: PermissionKey) {
  return ROLE_PERMISSIONS[roleName].includes(permission);
}

export function getVisibleMenuItems(
  roleName: RoleName,
  planFeatures?: Record<string, boolean>
): MenuItem[] {
  return TENANT_MENU_ITEMS.filter((item) => {
    // Dashboard always visible
    if (!item.permission) return true;
    // Check role permission
    if (!hasPermission(roleName, item.permission)) return false;
    // Check plan feature if required
    if (item.planFeature && planFeatures) {
      return planFeatures[item.planFeature] === true;
    }
    return true;
  });
}
