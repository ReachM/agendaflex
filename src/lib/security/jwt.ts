import type { RoleName } from "@prisma/client";
import { jwtVerify, SignJWT } from "jose";

export type AuthTokenPayload = {
  sub: string;
  role: RoleName;
  companyId?: string;
};

function secretKey() {
  const secret = process.env.AUTH_SECRET ?? "dev-marcaiflex-secret-change-me-with-32-characters";

  if (process.env.NODE_ENV === "production" && secret.includes("change-me")) {
    throw new Error("AUTH_SECRET precisa ser configurado em produção.");
  }

  return new TextEncoder().encode(secret);
}

export async function signAuthToken(payload: AuthTokenPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secretKey());
}

export async function verifyAuthToken(token: string): Promise<AuthTokenPayload> {
  const { payload } = await jwtVerify(token, secretKey());

  if (!payload.sub || !payload.role) {
    throw new Error("Token inválido.");
  }

  return {
    sub: String(payload.sub),
    role: payload.role as RoleName,
    companyId: payload.companyId ? String(payload.companyId) : undefined
  };
}
