import { describe, expect, it } from "vitest";

import {
  isPastDueGraceExpired,
  mapAsaasStatus,
  PAST_DUE_GRACE_DAYS,
  parseAsaasWebhook,
  pastDueDeadline,
  validateAsaasWebhook
} from "@/lib/services/asaas";

const DAY = 24 * 60 * 60 * 1000;

describe("mapAsaasStatus", () => {
  it("PAYMENT_CONFIRMED -> ACTIVE, limpa atraso e empurra período", () => {
    expect(mapAsaasStatus("PAYMENT_CONFIRMED")).toEqual({
      status: "ACTIVE",
      advancePeriod: true,
      markPastDue: false,
      clearPastDue: true
    });
  });

  it("PAYMENT_RECEIVED -> ACTIVE (mesmo efeito de CONFIRMED)", () => {
    expect(mapAsaasStatus("PAYMENT_RECEIVED")?.status).toBe("ACTIVE");
  });

  it("PAYMENT_OVERDUE -> PAST_DUE e marca início do atraso", () => {
    expect(mapAsaasStatus("PAYMENT_OVERDUE")).toMatchObject({
      status: "PAST_DUE",
      markPastDue: true,
      advancePeriod: false
    });
  });

  it("SUBSCRIPTION_INACTIVATED -> CANCELLED", () => {
    expect(mapAsaasStatus("SUBSCRIPTION_INACTIVATED")?.status).toBe("CANCELLED");
  });

  it("SUBSCRIPTION_DELETED -> CANCELLED", () => {
    expect(mapAsaasStatus("SUBSCRIPTION_DELETED")?.status).toBe("CANCELLED");
  });

  it("PAYMENT_DELETED / PAYMENT_REFUNDED -> null (apenas auditado)", () => {
    expect(mapAsaasStatus("PAYMENT_DELETED")).toBeNull();
    expect(mapAsaasStatus("PAYMENT_REFUNDED")).toBeNull();
  });

  it("SUBSCRIPTION_CREATED -> null (já tratado no checkout)", () => {
    expect(mapAsaasStatus("SUBSCRIPTION_CREATED")).toBeNull();
  });

  it("é case-insensitive e tolera espaços", () => {
    expect(mapAsaasStatus("  payment_confirmed  ")?.status).toBe("ACTIVE");
  });
});

describe("validateAsaasWebhook", () => {
  function reqWith(token: string | null): any {
    return { headers: { get: (k: string) => (k.toLowerCase() === "asaas-access-token" ? token : null) } };
  }

  it("retorna true quando o header bate com ASAAS_WEBHOOK_TOKEN", () => {
    process.env.ASAAS_WEBHOOK_TOKEN = "segredo-correto";
    expect(validateAsaasWebhook(reqWith("segredo-correto"))).toBe(true);
  });

  it("retorna false quando o header está ausente", () => {
    process.env.ASAAS_WEBHOOK_TOKEN = "segredo-correto";
    expect(validateAsaasWebhook(reqWith(null))).toBe(false);
  });

  it("retorna false quando o header não bate", () => {
    process.env.ASAAS_WEBHOOK_TOKEN = "segredo-correto";
    expect(validateAsaasWebhook(reqWith("token-errado"))).toBe(false);
  });

  it("retorna false quando ASAAS_WEBHOOK_TOKEN não está configurado", () => {
    delete process.env.ASAAS_WEBHOOK_TOKEN;
    expect(validateAsaasWebhook(reqWith("qualquer"))).toBe(false);
  });
});

describe("parseAsaasWebhook", () => {
  it("evento PAYMENT_* extrai paymentId, subscription e status", () => {
    const parsed = parseAsaasWebhook({
      event: "PAYMENT_CONFIRMED",
      payment: { id: "pay_1", subscription: "sub_1", status: "CONFIRMED", externalReference: "internal-sub-1" }
    });
    expect(parsed).toEqual({
      kind: "payment",
      event: "PAYMENT_CONFIRMED",
      status: "CONFIRMED",
      gatewaySubscriptionId: "sub_1",
      paymentId: "pay_1",
      externalReference: "internal-sub-1",
      resourceId: "pay_1"
    });
  });

  it("evento SUBSCRIPTION_* extrai subscription.id", () => {
    const parsed = parseAsaasWebhook({
      event: "SUBSCRIPTION_INACTIVATED",
      subscription: { id: "sub_9", status: "INACTIVE", externalReference: "internal-sub-9" }
    });
    expect(parsed).toMatchObject({
      kind: "subscription",
      event: "SUBSCRIPTION_INACTIVATED",
      gatewaySubscriptionId: "sub_9",
      externalReference: "internal-sub-9",
      resourceId: "sub_9"
    });
  });

  it("evento desconhecido retorna null", () => {
    expect(parseAsaasWebhook({ event: "FOO_BAR" })).toBeNull();
  });

  it("corpo inválido retorna null", () => {
    expect(parseAsaasWebhook(null)).toBeNull();
    expect(parseAsaasWebhook("string")).toBeNull();
    expect(parseAsaasWebhook({})).toBeNull();
  });
});

describe("régua dos 7 dias (PAST_DUE)", () => {
  it("PAST_DUE_GRACE_DAYS é 7", () => {
    expect(PAST_DUE_GRACE_DAYS).toBe(7);
  });

  it("pastDueDeadline = pastDueSince + 7 dias", () => {
    const since = new Date("2026-05-01T12:00:00.000Z");
    expect(pastDueDeadline(since).getTime()).toBe(since.getTime() + 7 * DAY);
  });

  it("dentro de 7 dias -> ainda ativo (não bloqueia)", () => {
    const now = new Date("2026-05-10T00:00:00.000Z");
    const since = new Date(now.getTime() - 3 * DAY);
    expect(isPastDueGraceExpired(since, now)).toBe(false);
  });

  it("pastDueSince + 7 dias (ou mais) -> bloqueado", () => {
    const now = new Date("2026-05-10T00:00:00.000Z");
    const exactly = new Date(now.getTime() - 7 * DAY);
    const past = new Date(now.getTime() - 8 * DAY);
    expect(isPastDueGraceExpired(exactly, now)).toBe(true);
    expect(isPastDueGraceExpired(past, now)).toBe(true);
  });

  it("sem pastDueSince -> não bloqueia por este motivo", () => {
    expect(isPastDueGraceExpired(null)).toBe(false);
    expect(isPastDueGraceExpired(undefined)).toBe(false);
  });
});
