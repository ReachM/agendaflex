import type { NextRequest } from "next/server";

export function getRequestIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export function getUserAgent(request: NextRequest) {
  return request.headers.get("user-agent") ?? "unknown";
}
