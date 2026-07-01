import { NextRequest } from "next/server";
import { ApiError, created, handleApiError } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/security/csrf";
import { signAuthToken } from "@/lib/security/jwt";
import { rateLimit } from "@/lib/security/rate-limit";
import { getRequestIp } from "@/lib/security/request";
import { redeemCoupon } from "@/lib/services/commissions";
import { sendNewTenantAlert, sendWelcomeEmail } from "@/lib/services/notifications";
import { provisionTenant } from "@/lib/services/provision-tenant";
import { registerSchema } from "@/lib/validation/schemas";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    rateLimit(`register:${getRequestIp(request)}`, 5, 60 * 60 * 1000);

    const body = registerSchema.parse(await request.json());

    // Confirmação de e-mail obrigatória antes de provisionar o tenant.
    if (!body.emailVerificationCode) {
      throw new ApiError(422, "Código de verificação obrigatório.");
    }
    const verificationEmail = body.adminEmail.toLowerCase();
    const verification = await prisma.emailVerification.findFirst({
      where: {
        email: verificationEmail,
        code: body.emailVerificationCode,
        usedAt: null,
        expiresAt: { gt: new Date() }
      }
    });
    if (!verification) {
      throw new ApiError(422, "Código de verificação inválido ou expirado.");
    }
    await prisma.emailVerification.update({
      where: { id: verification.id },
      data: { usedAt: new Date() }
    });

    const result = await prisma.$transaction((tx) =>
      provisionTenant(tx, {
        company: {
          name: body.companyName,
          document: body.document,
          phone: body.companyPhone,
          segment: body.segment
        },
        admin: {
          name: body.adminName,
          email: body.adminEmail,
          password: body.adminPassword
        }
      })
    );

    const token = await signAuthToken({
      sub: result.user.id,
      role: result.role,
      companyId: result.company.id
    });

    const response = created({
      user: result.user,
      role: result.role,
      company: {
        id: result.company.id,
        name: result.company.name,
        slug: result.company.slug,
        segment: result.company.segment
      },
      subscription: {
        status: result.subscription.status,
        trialEndsAt: result.subscription.trialEndsAt
      },
      redirectTo: "/dashboard"
    });

    response.cookies.set("marcaiflex_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 8
    });

    await audit(request, null, {
      action: "auth.register",
      entityType: "company",
      entityId: result.company.id,
      userId: result.user.id,
      companyId: result.company.id,
      newValues: {
        companyName: result.company.name,
        segment: result.company.segment,
        subscriptionStatus: result.subscription.status
      }
    });

    // Fire-and-forget — o e-mail de boas-vindas nunca bloqueia nem quebra o cadastro.
    sendWelcomeEmail({
      adminName: result.user.name,
      adminEmail: result.user.email,
      companyName: result.company.name,
      companySlug: result.company.slug ?? result.company.id,
      planName: "Starter",
      trialDays: 7
    }).catch((err) => console.error("[Welcome Email] failed:", err));

    // Cupom de indicação (opcional): vincula o tenant ao influencer JÁ no cadastro,
    // mesmo em trial. Cupom inválido NÃO bloqueia o cadastro — apenas não vincula.
    if (body.couponCode) {
      try {
        await redeemCoupon(result.company.id, body.couponCode);
      } catch (err) {
        console.error("[Coupon Redeem] falha ao vincular cupom no cadastro:", err);
      }
    }

    // Notifica o super admin sobre o novo cliente — fire-and-forget.
    sendNewTenantAlert({
      userName: result.user.name,
      userEmail: result.user.email,
      companyName: result.company.name,
      source: "email"
    }).catch((err) => console.error("[New Tenant Alert Email]", err));

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
