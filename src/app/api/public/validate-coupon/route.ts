import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/security/rate-limit";
import { getRequestIp } from "@/lib/security/request";
import { validateCouponQuerySchema } from "@/lib/validation/schemas";

/**
 * Validação PÚBLICA de cupom, usada no checkout/cadastro para mostrar o desconto
 * antes de confirmar. Rota aberta (sem auth) — por isso é rate-limitada por IP,
 * no mesmo padrão das demais rotas públicas. Nunca revela dados sensíveis do
 * influencer: só retorna se o cupom é válido e o desconto aplicável.
 */
export async function GET(request: NextRequest) {
  try {
    rateLimit(`validate-coupon:${getRequestIp(request)}`, 30, 60 * 1000);

    const { searchParams } = new URL(request.url);
    const parsed = validateCouponQuerySchema.safeParse({ code: searchParams.get("code") ?? "" });
    if (!parsed.success) {
      return ok({ valid: false });
    }

    const coupon = await prisma.coupon.findFirst({
      where: { code: parsed.data.code, active: true },
      select: { code: true, discountPct: true }
    });

    if (!coupon) {
      return ok({ valid: false });
    }

    return ok({
      valid: true,
      code: coupon.code,
      discountPct: coupon.discountPct != null ? Number(coupon.discountPct) : null
    });
  } catch (error) {
    return handleApiError(error);
  }
}
