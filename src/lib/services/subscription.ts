import type { SubscriptionStatus } from "@prisma/client";
import { ApiError } from "@/lib/api/errors";
import { isPastDueGraceExpired } from "@/lib/payments/grace";
import { prisma } from "@/lib/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;

export type SubscriptionState = {
  status: SubscriptionStatus | "NONE";
  planSlug: string | null;
  planName: string | null;
  isTrial: boolean;
  trialEndsAt: Date | null;
  trialDaysLeft: number; // nunca negativo; 0 = último dia
  isBlocked: boolean;
};

const UNSUBSCRIBED_STATE: SubscriptionState = {
  status: "NONE",
  planSlug: null,
  planName: null,
  isTrial: false,
  trialEndsAt: null,
  trialDaysLeft: 0,
  isBlocked: false
};

/**
 * Diferença em dias de CALENDÁRIO entre duas datas (end - start). Usa os
 * componentes locais de data para que "faltam X dias" não dependa da hora do dia:
 * mesmo dia => 0 ("acaba hoje"), amanhã => 1, etc.
 */
function calendarDaysBetween(start: Date, end: Date): number {
  const a = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const b = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((b - a) / DAY_MS);
}

/**
 * Estado atual da assinatura da empresa, calculado em TEMPO REAL.
 *
 * O bloqueio é determinado por DATA (trialEndsAt < agora), não por um job que
 * muda status — assim a expiração vale mesmo sem cron. Um job opcional pode
 * marcar EXPIRED depois, mas esta checagem é a fonte de verdade.
 */
export async function getSubscriptionState(companyId: string): Promise<SubscriptionState> {
  // Preferimos uma assinatura vigente (ACTIVE|TRIALING). Sem ela, olhamos a mais
  // recente para detectar estados terminais (EXPIRED/CANCELLED/PAST_DUE).
  const current = await prisma.companySubscription.findFirst({
    where: { companyId, status: { in: ["ACTIVE", "TRIALING"] } },
    include: { plan: true },
    orderBy: { createdAt: "desc" }
  });

  const subscription =
    current ??
    (await prisma.companySubscription.findFirst({
      where: { companyId },
      include: { plan: true },
      orderBy: { createdAt: "desc" }
    }));

  if (!subscription) return UNSUBSCRIBED_STATE;

  const now = new Date();
  const isTrial = subscription.status === "TRIALING";
  const trialEndsAt = subscription.trialEndsAt;
  const trialExpired = isTrial && trialEndsAt != null && trialEndsAt.getTime() < now.getTime();

  const trialDaysLeft =
    isTrial && trialEndsAt && !trialExpired ? Math.max(0, calendarDaysBetween(now, trialEndsAt)) : 0;

  // PAST_DUE só bloqueia DEPOIS dos 7 dias de tolerância (cartão recusado). Dentro
  // da régua, o acesso continua ativo. EXPIRED/CANCELLED bloqueiam de imediato.
  const pastDueBlocked =
    subscription.status === "PAST_DUE" && isPastDueGraceExpired(subscription.pastDueSince, now);

  const isBlocked =
    trialExpired ||
    subscription.status === "EXPIRED" ||
    subscription.status === "CANCELLED" ||
    pastDueBlocked;

  return {
    status: subscription.status,
    planSlug: subscription.plan.slug,
    planName: subscription.plan.name,
    isTrial,
    trialEndsAt,
    trialDaysLeft,
    isBlocked
  };
}

/**
 * Lança 403 TRIAL_EXPIRED quando a assinatura está bloqueada. Usado pelo
 * enforcement central (requireTenant) nas rotas de escrita.
 */
export async function assertSubscriptionActive(companyId: string): Promise<SubscriptionState> {
  const state = await getSubscriptionState(companyId);
  if (state.isBlocked) {
    throw new ApiError(
      403,
      "Seu período de teste terminou. Escolha um plano para continuar usando a agenda.",
      { code: "TRIAL_EXPIRED" }
    );
  }
  return state;
}
