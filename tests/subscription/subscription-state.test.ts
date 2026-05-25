import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    companySubscription: { findFirst: vi.fn() }
  } as any
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { assertSubscriptionActive, getSubscriptionState } from "@/lib/services/subscription";

const DAY = 24 * 60 * 60 * 1000;
const MAX = { slug: "max", name: "Max" };

function sub(overrides: Record<string, unknown>) {
  return { status: "TRIALING", trialEndsAt: null, plan: MAX, createdAt: new Date(), ...overrides };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("getSubscriptionState", () => {
  it("trial dentro do prazo -> isBlocked false e trialDaysLeft correto", async () => {
    const trialEndsAt = new Date(Date.now() + 3 * DAY);
    prismaMock.companySubscription.findFirst.mockResolvedValue(sub({ status: "TRIALING", trialEndsAt }));

    const state = await getSubscriptionState("company-1");

    expect(state.isBlocked).toBe(false);
    expect(state.isTrial).toBe(true);
    expect(state.trialDaysLeft).toBe(3);
    expect(state.planSlug).toBe("max");
  });

  it("trial vencido (trialEndsAt no passado) -> isBlocked true", async () => {
    const trialEndsAt = new Date(Date.now() - 1 * DAY);
    prismaMock.companySubscription.findFirst.mockResolvedValue(sub({ status: "TRIALING", trialEndsAt }));

    const state = await getSubscriptionState("company-1");

    expect(state.isBlocked).toBe(true);
    expect(state.trialDaysLeft).toBe(0); // nunca negativo
  });

  it("assinatura ACTIVE -> nunca bloqueada", async () => {
    prismaMock.companySubscription.findFirst.mockResolvedValue(
      sub({ status: "ACTIVE", trialEndsAt: null })
    );

    const state = await getSubscriptionState("company-1");

    expect(state.isBlocked).toBe(false);
    expect(state.isTrial).toBe(false);
  });

  it("sem nenhuma assinatura -> não bloqueia (status NONE)", async () => {
    prismaMock.companySubscription.findFirst.mockResolvedValue(null);

    const state = await getSubscriptionState("company-1");

    expect(state.status).toBe("NONE");
    expect(state.isBlocked).toBe(false);
  });

  it("status EXPIRED -> isBlocked true", async () => {
    // Sem ACTIVE/TRIALING vigente; cai na busca da assinatura mais recente.
    prismaMock.companySubscription.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(sub({ status: "EXPIRED", trialEndsAt: null }));

    const state = await getSubscriptionState("company-1");

    expect(state.isBlocked).toBe(true);
  });

  it("PAST_DUE dentro dos 7 dias -> ainda ativo (não bloqueia)", async () => {
    prismaMock.companySubscription.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(sub({ status: "PAST_DUE", trialEndsAt: null, pastDueSince: new Date(Date.now() - 3 * DAY) }));

    const state = await getSubscriptionState("company-1");

    expect(state.status).toBe("PAST_DUE");
    expect(state.isBlocked).toBe(false);
  });

  it("PAST_DUE com 7 dias vencidos -> isBlocked true", async () => {
    prismaMock.companySubscription.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(sub({ status: "PAST_DUE", trialEndsAt: null, pastDueSince: new Date(Date.now() - 8 * DAY) }));

    const state = await getSubscriptionState("company-1");

    expect(state.isBlocked).toBe(true);
  });
});

describe("assertSubscriptionActive", () => {
  it("lança 403 TRIAL_EXPIRED quando bloqueada", async () => {
    prismaMock.companySubscription.findFirst.mockResolvedValue(
      sub({ status: "TRIALING", trialEndsAt: new Date(Date.now() - DAY) })
    );

    await expect(assertSubscriptionActive("company-1")).rejects.toMatchObject({
      status: 403,
      details: { code: "TRIAL_EXPIRED" }
    });
  });

  it("não lança quando ativa", async () => {
    prismaMock.companySubscription.findFirst.mockResolvedValue(
      sub({ status: "ACTIVE", trialEndsAt: null })
    );

    await expect(assertSubscriptionActive("company-1")).resolves.toMatchObject({ isBlocked: false });
  });
});
