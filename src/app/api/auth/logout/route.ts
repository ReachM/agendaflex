import { NextRequest, NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { handleApiError } from "@/lib/api/errors";
import { requireAnyAuth } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const response = NextResponse.json({ ok: true });

    try {
      const context = await requireAnyAuth(request);
      await audit(request, context, {
        action: "auth.logout",
        entityType: "user",
        entityId: context.user.id
      });
    } catch {
      // Logout must clear the cookie even when the session is already invalid.
    }

    response.cookies.set("marcaiflex_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 0
    });

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
