import type { Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";
import type { AuthContext } from "@/lib/security/auth";
import { prisma } from "@/lib/prisma";
import { getRequestIp, getUserAgent } from "@/lib/security/request";

type AuditInput = {
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValues?: unknown;
  newValues?: unknown;
  companyId?: string | null;
  userId?: string | null;
};

function toAuditJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function audit(request: NextRequest, context: AuthContext | null, input: AuditInput) {
  await prisma.auditLog.create({
    data: {
      companyId: input.companyId ?? context?.companyId ?? null,
      userId: input.userId ?? context?.user.id ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      oldValues: toAuditJson(input.oldValues),
      newValues: toAuditJson(input.newValues),
      ipAddress: getRequestIp(request),
      userAgent: getUserAgent(request)
    }
  });
}
