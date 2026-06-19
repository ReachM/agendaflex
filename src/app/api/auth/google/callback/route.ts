import { NextRequest, NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { signAuthToken, type AuthTokenPayload } from "@/lib/security/jwt";
import { exchangeCodeForTokens, getGoogleUserInfo } from "@/lib/services/google-oauth";
import { sendNewTenantAlert, sendWelcomeEmail } from "@/lib/services/notifications";
import { provisionTenant } from "@/lib/services/provision-tenant";

/** Cookie de sessão (mesmo formato de /api/auth/login e /register). */
function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set("marcaiflex_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // "lax" (e não "strict"): após o redirect vindo do Google (contexto
    // cross-site), "strict" faria o browser omitir o cookie na primeira
    // navegação para /dashboard, derrubando o usuário de volta ao /login.
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8 // 8h
  });
  response.cookies.delete("google_oauth_state");
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  // Usuário cancelou no Google.
  if (errorParam === "access_denied") {
    return NextResponse.redirect(new URL("/login?error=cancelled", request.url));
  }

  // Valida o state (CSRF) contra o cookie salvo na rota de início.
  const savedState = request.cookies.get("google_oauth_state")?.value;
  if (!code || !state || state !== savedState) {
    return NextResponse.redirect(new URL("/login?error=invalid_state", request.url));
  }

  try {
    // 1. code → tokens → perfil verificado.
    const tokens = await exchangeCodeForTokens(code);
    const profile = await getGoogleUserInfo(tokens.access_token);
    const email = profile.email.toLowerCase();

    // 2. Procura usuário por googleId ou e-mail, com o vínculo ativo mais antigo.
    const user = await prisma.user.findFirst({
      where: { OR: [{ googleId: profile.sub }, { email }] },
      include: {
        systemRole: { select: { name: true } },
        memberships: {
          where: { status: "ACTIVE" },
          include: {
            company: { select: { id: true, name: true, slug: true, status: true } },
            role: { select: { name: true } }
          },
          orderBy: { createdAt: "asc" },
          take: 1
        }
      }
    });

    // ── 3a. NOVO usuário via Google → provisiona o tenant completo ──────────────
    // (User + Company + Membership + Subscription trial), reaproveitando o mesmo
    // serviço do cadastro por e-mail. Empresa nasce com o nome do usuário (ele
    // renomeia depois em Configurações) e sem senha utilizável (login via Google).
    if (!user) {
      const result = await prisma.$transaction((tx) =>
        provisionTenant(tx, {
          company: { name: profile.name, segment: "PERSONALIZADO" },
          admin: {
            name: profile.name,
            email,
            password: crypto.randomUUID(),
            googleId: profile.sub
          }
        })
      );

      const token = await signAuthToken({
        sub: result.user.id,
        role: result.role,
        companyId: result.company.id
      });

      await audit(request, null, {
        action: "auth.google_register",
        entityType: "user",
        entityId: result.user.id,
        userId: result.user.id,
        companyId: result.company.id
      });

      // Fire-and-forget — nunca bloqueia o login.
      sendWelcomeEmail({
        adminName: result.user.name,
        adminEmail: result.user.email,
        companyName: result.company.name,
        companySlug: result.company.slug ?? result.company.id,
        planName: "Starter",
        trialDays: 7
      }).catch((err) => console.error("[Welcome Email Google]", err));

      // Notifica o super admin sobre o novo cliente — fire-and-forget.
      sendNewTenantAlert({
        userName: result.user.name,
        userEmail: result.user.email,
        companyName: result.company.name,
        source: "google"
      }).catch(console.error);

      const response = NextResponse.redirect(new URL("/dashboard", request.url));
      setSessionCookie(response, token);
      return response;
    }

    // ── 3b. Usuário existente → login (e vínculo do googleId, se faltar) ─────────
    if (user.status !== "ACTIVE") {
      return NextResponse.redirect(new URL("/login?error=account_suspended", request.url));
    }

    if (!user.googleId) {
      await prisma.user.update({ where: { id: user.id }, data: { googleId: profile.sub } });
    }

    const membership = user.memberships[0];
    const isSuperAdmin = user.systemRole?.name === "SUPER_ADMIN";

    const tokenPayload: AuthTokenPayload = {
      sub: user.id,
      role: isSuperAdmin ? user.systemRole!.name : (membership?.role?.name ?? "USER"),
      companyId: membership?.company?.id
    };

    const token = await signAuthToken(tokenPayload);

    await audit(request, null, {
      action: "auth.google_login",
      entityType: "user",
      entityId: user.id,
      userId: user.id,
      companyId: membership?.company?.id ?? null
    });

    const redirectTo = isSuperAdmin ? "/master" : "/dashboard";
    const response = NextResponse.redirect(new URL(redirectTo, request.url));
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    console.error("[Google OAuth callback error]", error);
    return NextResponse.redirect(new URL("/login?error=oauth_failed", request.url));
  }
}
