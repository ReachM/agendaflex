import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";

/**
 * GET /api/company/check-slug?slug=minha-empresa
 * Verifica em tempo real se um slug está disponível (ignorando a própria empresa).
 */
export async function GET(request: NextRequest) {
  try {
    const context = await requireTenant(request);
    const slug = (new URL(request.url).searchParams.get("slug") ?? "").trim().toLowerCase();
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) return ok({ available: false });

    const existing = await prisma.company.findFirst({
      where: { slug, id: { not: context.companyId } },
      select: { id: true }
    });
    return ok({ available: !existing });
  } catch (error) {
    return handleApiError(error);
  }
}
