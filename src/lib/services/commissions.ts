import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendCommissionAlert } from "@/lib/services/notifications";

/**
 * Programa de comissão por influenciadores.
 *
 * Modelo de negócio: cada influencer indica tenants (Company) via cupom. Enquanto
 * o tenant paga a mensalidade (dentro da janela `commissionMonthsLimit`), geramos
 * uma comissão mensal. O percentual é ESCALONADO pela quantidade de assinantes
 * ativos que o influencer trouxe (faixas em `CommissionTier`).
 *
 * As funções PURAS abaixo (pickCommissionTier, calculateCommissionAmount,
 * addMonths, isWithinCommissionWindow) não tocam o banco e são cobertas por
 * testes unitários. As funções impuras consultam o Prisma.
 */

export type CommissionTierLike = {
  minSubscribers: number;
  maxSubscribers: number | null;
  commissionPct: number;
};

/**
 * PURA. Escolhe a faixa de comissão para uma dada quantidade de assinantes.
 * `maxSubscribers: null` significa "sem limite superior". Retorna `null` quando
 * nenhuma faixa cobre o valor (ex.: nenhuma faixa cadastrada, ou count=0 e a
 * menor faixa começa em 1).
 */
export function pickCommissionTier(
  subscriberCount: number,
  tiers: CommissionTierLike[]
): CommissionTierLike | null {
  const sorted = [...tiers].sort((a, b) => a.minSubscribers - b.minSubscribers);
  for (const tier of sorted) {
    const max = tier.maxSubscribers ?? Number.POSITIVE_INFINITY;
    if (subscriberCount >= tier.minSubscribers && subscriberCount <= max) {
      return tier;
    }
  }
  return null;
}

/**
 * PURA. Comissão = valor do pagamento × pct / 100, arredondada a 2 casas
 * (half-up) para casar com DECIMAL(10,2) no banco.
 */
export function calculateCommissionAmount(paymentAmount: number, commissionPct: number): number {
  if (!Number.isFinite(paymentAmount) || !Number.isFinite(commissionPct)) return 0;
  const raw = (paymentAmount * commissionPct) / 100;
  return Math.round((raw + Number.EPSILON) * 100) / 100;
}

/** PURA. Soma `months` meses a uma data (preserva o fim de mês do JS Date). */
export function addMonths(base: Date, months: number): Date {
  const next = new Date(base);
  next.setMonth(next.getMonth() + months);
  return next;
}

/**
 * PURA. O tenant ainda gera comissão? Só até `createdAt + commissionMonthsLimit`
 * meses após resgatar o cupom.
 */
export function isWithinCommissionWindow(
  redemptionCreatedAt: Date,
  commissionMonthsLimit: number,
  now: Date = new Date()
): boolean {
  return now.getTime() <= addMonths(redemptionCreatedAt, commissionMonthsLimit).getTime();
}

/** PURA. Mês de referência no formato "YYYY-MM" (usado como chave idempotente). */
export function referenceMonthOf(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Impura. Conta tenants DISTINTOS e ativos (assinatura ACTIVE, dentro da janela
 * de `commissionMonthsLimit`) vinculados a este influencer via cupom.
 */
export async function countActiveSubscribers(
  influencerId: string,
  now: Date = new Date()
): Promise<number> {
  const redemptions = await prisma.couponRedemption.findMany({
    where: { coupon: { influencerId } },
    select: {
      companyId: true,
      createdAt: true,
      commissionMonthsLimit: true,
      company: {
        select: {
          subscriptions: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { status: true }
          }
        }
      }
    }
  });

  const active = new Set<string>();
  for (const r of redemptions) {
    if (!isWithinCommissionWindow(r.createdAt, r.commissionMonthsLimit, now)) continue;
    if (r.company.subscriptions[0]?.status === "ACTIVE") active.add(r.companyId);
  }
  return active.size;
}

/**
 * Impura. Calcula a faixa atual do influencer: quantos assinantes ativos ele tem
 * e qual o percentual de comissão correspondente. `commissionPct` = 0 quando
 * nenhuma faixa cadastrada cobre a contagem.
 */
export async function calculateInfluencerTier(
  influencerId: string,
  now: Date = new Date()
): Promise<{ subscriberCount: number; commissionPct: number; tier: CommissionTierLike | null }> {
  const subscriberCount = await countActiveSubscribers(influencerId, now);
  const tiers = await prisma.commissionTier.findMany();
  const tier = pickCommissionTier(
    subscriberCount,
    tiers.map((t) => ({
      minSubscribers: t.minSubscribers,
      maxSubscribers: t.maxSubscribers,
      commissionPct: Number(t.commissionPct)
    }))
  );
  return { subscriberCount, commissionPct: tier?.commissionPct ?? 0, tier };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export type RedeemResult =
  | { ok: true; redemptionId: string; discountPct: number | null }
  | { ok: false; reason: "invalid" | "already_redeemed" };

/**
 * Vincula um tenant (Company) a um cupom. Não lança em fluxo normal — retorna um
 * resultado para o chamador decidir o que fazer (o cadastro NUNCA é bloqueado por
 * cupom inválido). Idempotente: se a empresa já resgatou um cupom, não cria outro
 * (constraint unique em companyId).
 */
export async function redeemCoupon(companyId: string, rawCode: string): Promise<RedeemResult> {
  const code = rawCode.toUpperCase().replace(/\s+/g, "");
  const coupon = await prisma.coupon.findFirst({
    where: { code, active: true },
    select: { id: true, discountPct: true }
  });
  if (!coupon) return { ok: false, reason: "invalid" };

  const existing = await prisma.couponRedemption.findUnique({
    where: { companyId },
    select: { id: true }
  });
  if (existing) return { ok: false, reason: "already_redeemed" };

  try {
    const created = await prisma.couponRedemption.create({
      data: { couponId: coupon.id, companyId }
    });
    return {
      ok: true,
      redemptionId: created.id,
      discountPct: coupon.discountPct != null ? Number(coupon.discountPct) : null
    };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "already_redeemed" };
    throw error;
  }
}

/**
 * Registra a comissão do mês quando um pagamento de mensalidade é confirmado.
 * Chamada pelo webhook do MP DEPOIS de confirmar o pagamento (best-effort — nunca
 * deve quebrar o webhook). Idempotente por (companyId, referenceMonth): reenvios
 * do MP no mesmo mês não duplicam. Notifica o super admin apenas no PRIMEIRO
 * pagamento de um tenant vindo de cupom (flag `notifiedAt`).
 */
export async function recordCommissionForPaidPeriod(params: {
  companyId: string;
  paymentAmount?: number | null;
  now?: Date;
}): Promise<void> {
  const now = params.now ?? new Date();

  const redemption = await prisma.couponRedemption.findUnique({
    where: { companyId: params.companyId },
    select: {
      id: true,
      createdAt: true,
      commissionMonthsLimit: true,
      notifiedAt: true,
      coupon: {
        select: {
          code: true,
          influencerId: true,
          influencer: { select: { name: true } }
        }
      }
    }
  });
  if (!redemption) return; // tenant não veio de cupom — nada a fazer.
  if (!isWithinCommissionWindow(redemption.createdAt, redemption.commissionMonthsLimit, now)) {
    return; // passou da janela de comissão.
  }

  // Valor pago: prioriza o valor real do pagamento; senão, o preço do plano.
  const subscription = await prisma.companySubscription.findFirst({
    where: { companyId: params.companyId },
    orderBy: { createdAt: "desc" },
    select: { plan: { select: { name: true, price: true } } }
  });
  let amount = params.paymentAmount ?? 0;
  if (!(amount > 0)) amount = subscription?.plan ? Number(subscription.plan.price) : 0;
  if (!(amount > 0)) return; // sem valor confiável — não registra comissão.

  const influencerId = redemption.coupon.influencerId;
  const { commissionPct } = await calculateInfluencerTier(influencerId, now);
  const commissionAmount = calculateCommissionAmount(amount, commissionPct);
  const referenceMonth = referenceMonthOf(now);

  const priorCount = await prisma.commissionPayment.count({
    where: { companyId: params.companyId }
  });
  const isFirstPayment = priorCount === 0;

  try {
    await prisma.commissionPayment.create({
      data: {
        influencerId,
        companyId: params.companyId,
        referenceMonth,
        subscriptionPaymentAmount: amount,
        appliedCommissionPct: commissionPct,
        commissionAmount,
        status: "pending"
      }
    });
  } catch (error) {
    if (isUniqueViolation(error)) return; // comissão do mês já existe — idempotente.
    throw error;
  }

  // Aviso ao super admin só no primeiro pagamento e uma única vez.
  if (isFirstPayment && !redemption.notifiedAt) {
    const company = await prisma.company.findUnique({
      where: { id: params.companyId },
      select: { name: true }
    });
    await sendCommissionAlert({
      companyName: company?.name ?? params.companyId,
      planName: subscription?.plan?.name ?? "—",
      couponCode: redemption.coupon.code,
      influencerName: redemption.coupon.influencer.name,
      paymentAmount: amount,
      commissionAmount,
      commissionPct
    }).catch((err) => console.error("[Commission Alert] falha ao enviar:", err));

    await prisma.couponRedemption
      .update({ where: { id: redemption.id }, data: { notifiedAt: now } })
      .catch(() => {}); // nunca deixa a marcação quebrar o fluxo.
  }
}
