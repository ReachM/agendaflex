import type { NextRequest } from "next/server";
import { ApiError } from "@/lib/api/errors";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function assertSameOrigin(request: NextRequest) {
  if (SAFE_METHODS.has(request.method)) return;

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (!origin || !host) return;

  try {
    const originHost = new URL(origin).host;
    if (originHost !== host) {
      throw new ApiError(403, "Origem da requisição não autorizada.");
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(403, "Origem da requisição inválida.");
  }
}
