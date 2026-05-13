import { ApiError } from "@/lib/api/errors";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  current.count += 1;

  if (current.count > limit) {
    throw new ApiError(429, "Muitas tentativas. Aguarde alguns minutos e tente novamente.");
  }
}
