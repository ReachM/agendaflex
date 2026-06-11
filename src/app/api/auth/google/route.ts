import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/security/rate-limit";
import { getRequestIp } from "@/lib/security/request";
import { buildGoogleAuthUrl } from "@/lib/services/google-oauth";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://marcaiflex.com.br";

export async function GET(request: NextRequest) {
  try {
    rateLimit(`google-oauth-init:${getRequestIp(request)}`, 20, 60 * 1000);

    // State CSRF: token aleatório guardado em cookie httpOnly e validado no callback.
    const state = crypto.randomUUID();
    const response = NextResponse.redirect(buildGoogleAuthUrl(state));

    response.cookies.set("google_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      // `lax` (não `strict`): o cookie precisa ser enviado no redirect de volta
      // do Google (navegação top-level cross-site) para validar o state.
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 15
    });

    return response;
  } catch {
    return NextResponse.redirect(`${APP_URL}/login?error=oauth_unavailable`);
  }
}
