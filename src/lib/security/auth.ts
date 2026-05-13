import type { Company, CompanyUser, Role, RoleName, User } from "@prisma/client";
import type { NextRequest } from "next/server";
import { ApiError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { verifyAuthToken } from "@/lib/security/jwt";
import { hasPermission, type PermissionKey } from "@/lib/security/permissions";

type MembershipWithRole = CompanyUser & {
  company: Company;
  role: Role;
};

type UserWithAuth = User & {
  systemRole: Role | null;
  memberships: MembershipWithRole[];
};

export type SuperAdminContext = {
  kind: "super_admin";
  user: UserWithAuth;
  roleName: RoleName;
  companyId: null;
  company: null;
  membership: null;
};

export type TenantAuthContext = {
  kind: "tenant";
  user: UserWithAuth;
  roleName: RoleName;
  companyId: string;
  company: Company;
  membership: MembershipWithRole;
};

export type AuthContext = SuperAdminContext | TenantAuthContext;

function tokenFromRequest(request: NextRequest) {
  const bearer = request.headers.get("authorization");
  if (bearer?.startsWith("Bearer ")) return bearer.slice(7);
  return request.cookies.get("agendaflex_token")?.value;
}

async function resolveAuth(request: NextRequest): Promise<AuthContext> {
  const token = tokenFromRequest(request);
  if (!token) throw new ApiError(401, "Autenticação obrigatória.");

  let payload;
  try {
    payload = await verifyAuthToken(token);
  } catch {
    throw new ApiError(401, "Sessão inválida ou expirada.");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: {
      systemRole: true,
      memberships: {
        include: {
          company: true,
          role: true
        }
      }
    }
  });

  if (!user || user.status !== "ACTIVE") {
    throw new ApiError(401, "Usuário inativo ou não encontrado.");
  }

  if (payload.role === "SUPER_ADMIN" && user.systemRole?.name === "SUPER_ADMIN") {
    return {
      kind: "super_admin",
      user,
      roleName: "SUPER_ADMIN",
      companyId: null,
      company: null,
      membership: null
    };
  }

  if (!payload.companyId) {
    throw new ApiError(403, "Tenant obrigatório para esta sessão.");
  }

  const membership = user.memberships.find(
    (item) => item.companyId === payload.companyId && item.status === "ACTIVE"
  );

  if (!membership) {
    throw new ApiError(403, "Usuário não pertence ao tenant informado.");
  }

  if (membership.company.status !== "ACTIVE") {
    throw new ApiError(403, "Empresa inativa ou suspensa.");
  }

  return {
    kind: "tenant",
    user,
    roleName: membership.role.name,
    companyId: membership.companyId,
    company: membership.company,
    membership
  };
}

export async function requireSuperAdmin(request: NextRequest) {
  const context = await resolveAuth(request);
  if (context.kind !== "super_admin") {
    throw new ApiError(403, "Acesso restrito ao Super Admin.");
  }
  return context;
}

export async function requireTenant(request: NextRequest, permission?: PermissionKey) {
  const context = await resolveAuth(request);
  if (context.kind !== "tenant") {
    throw new ApiError(403, "Acesso restrito ao painel da empresa.");
  }

  if (permission && !hasPermission(context.roleName, permission)) {
    throw new ApiError(403, "Permissão insuficiente para esta ação.");
  }

  return context;
}

export async function requireAnyAuth(request: NextRequest, permission?: PermissionKey) {
  const context = await resolveAuth(request);

  if (permission && context.kind === "tenant" && !hasPermission(context.roleName, permission)) {
    throw new ApiError(403, "Permissão insuficiente para esta ação.");
  }

  if (permission && context.kind === "super_admin" && !hasPermission("SUPER_ADMIN", permission)) {
    throw new ApiError(403, "Permissão insuficiente para esta ação.");
  }

  return context;
}
