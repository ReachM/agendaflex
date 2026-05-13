import { ApiError } from "@/lib/api/errors";

export function tenantWhere<T extends Record<string, unknown>>(companyId: string, extra?: T) {
  return {
    ...(extra ?? {}),
    companyId
  };
}

export function assertSameTenant(resourceCompanyId: string | null | undefined, authCompanyId: string) {
  if (!resourceCompanyId || resourceCompanyId !== authCompanyId) {
    throw new ApiError(403, "Recurso fora do tenant autenticado.");
  }
}
