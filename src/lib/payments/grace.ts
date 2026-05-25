/**
 * Régua de tolerância de cartão recusado (PAST_DUE), em módulo PURO e SEM o SDK
 * do Mercado Pago — para poder ser usado pelo caminho de auth/assinatura
 * (subscription.ts -> requireTenant) sem arrastar o SDK para cada request.
 * O mercadopago.ts re-exporta estes símbolos para compatibilidade.
 */

/** Tolerância de cartão recusado: 7 dias em PAST_DUE antes de bloquear o acesso. */
export const PAST_DUE_GRACE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Momento em que o período de tolerância (7 dias) termina. */
export function pastDueDeadline(pastDueSince: Date): Date {
  return new Date(pastDueSince.getTime() + PAST_DUE_GRACE_DAYS * DAY_MS);
}

/**
 * A tolerância de cartão recusado já estourou? `true` => deve bloquear o acesso.
 * Dentro dos 7 dias retorna `false` (ainda ativo). Sem pastDueSince => não
 * bloqueia por este motivo.
 */
export function isPastDueGraceExpired(pastDueSince: Date | null | undefined, now: Date = new Date()): boolean {
  if (!pastDueSince) return false;
  return now.getTime() >= pastDueDeadline(pastDueSince).getTime();
}
