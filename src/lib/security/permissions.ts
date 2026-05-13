import type { RoleName } from "@prisma/client";

export const PERMISSIONS = [
  "companies:manage",
  "users:manage",
  "customers:manage",
  "services:manage",
  "professionals:manage",
  "appointments:manage",
  "custom_fields:manage",
  "reports:view",
  "logs:view",
  "settings:manage"
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<RoleName, PermissionKey[]> = {
  SUPER_ADMIN: [...PERMISSIONS],
  COMPANY_ADMIN: [
    "users:manage",
    "customers:manage",
    "services:manage",
    "professionals:manage",
    "appointments:manage",
    "custom_fields:manage",
    "reports:view",
    "logs:view",
    "settings:manage"
  ],
  MANAGER: [
    "customers:manage",
    "services:manage",
    "professionals:manage",
    "appointments:manage",
    "reports:view",
    "logs:view"
  ],
  STAFF: ["customers:manage", "appointments:manage"],
  USER: []
};

export function hasPermission(roleName: RoleName, permission: PermissionKey) {
  return ROLE_PERMISSIONS[roleName].includes(permission);
}
