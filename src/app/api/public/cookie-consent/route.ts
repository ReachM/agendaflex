import { NextRequest } from "next/server";
import { ok } from "@/lib/api/errors";
import { getRequestIp } from "@/lib/security/request";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const ip = getRequestIp(request);

    // Log simples — não salva IP completo (LGPD)
    console.log(
      `[CookieConsent] ${body.consent} | ${body.url} | ${new Date().toISOString()} | ${ip?.slice(0, 8)}...`
    );

    return ok({ ok: true });
  } catch {
    return ok({ ok: true }); // nunca falhar
  }
}
