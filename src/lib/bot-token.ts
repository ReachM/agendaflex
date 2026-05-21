import { jwtVerify, SignJWT } from "jose";
import { ApiError } from "@/lib/api/errors";

/**
 * Secret key for bot tokens — reuses AUTH_SECRET from the project.
 */
function botSecretKey() {
  const secret = process.env.AUTH_SECRET ?? "dev-agendaflex-secret-change-me-with-32-characters";

  if (process.env.NODE_ENV === "production" && secret.includes("change-me")) {
    throw new Error("AUTH_SECRET precisa ser configurado em produção.");
  }

  return new TextEncoder().encode(secret);
}

/**
 * Generate a JWT specifically for the bot.
 * The token has scope "bot", carries the companyId, and expires in 30 days.
 * This token must never be returned to the frontend.
 */
export async function generateBotToken(companyId: string): Promise<string> {
  return new SignJWT({ scope: "bot", companyId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(botSecretKey());
}

/**
 * Verify a bot JWT and extract the companyId.
 * Throws ApiError(401) when the token is invalid, expired, or has wrong scope.
 */
export async function verifyBotToken(token: string): Promise<{ companyId: string }> {
  try {
    const { payload } = await jwtVerify(token, botSecretKey());

    if (payload.scope !== "bot") {
      throw new ApiError(401, "Token com scope inválido.");
    }

    if (!payload.companyId || typeof payload.companyId !== "string") {
      throw new ApiError(401, "Token sem companyId válido.");
    }

    return { companyId: payload.companyId };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, "Token do bot inválido ou expirado.");
  }
}
