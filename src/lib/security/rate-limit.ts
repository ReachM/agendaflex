import { ApiError } from "@/lib/api/errors";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

// Limpa entradas expiradas a cada 5 minutos. Sem isso o Map cresce sem limite
// em produção (uma entrada por IP/chave que nunca é removida). `unref()` evita
// que o timer segure o event loop aberto no shutdown.
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt < now) buckets.delete(key);
    }
  }, 5 * 60 * 1000).unref?.();
}

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
