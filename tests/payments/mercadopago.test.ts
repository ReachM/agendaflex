import { describe, expect, it, vi } from "vitest";

// Sem chamadas reais ao MP: o SDK é mockado. As funções sob teste (mapMpStatus,
// régua de 7 dias) são puras e não tocam no SDK, mas mockamos para garantir que
// importar o módulo nunca dispare rede.
vi.mock("mercadopago", () => ({ MercadoPagoConfig: class {} }));

import {
  isPastDueGraceExpired,
  mapMpStatus,
  PAST_DUE_GRACE_DAYS,
  pastDueDeadline
} from "@/lib/services/mercadopago";

const DAY = 24 * 60 * 60 * 1000;

describe("mapMpStatus — preapproval", () => {
  it("authorized -> ACTIVE e limpa atraso", () => {
    expect(mapMpStatus("preapproval", "authorized")).toEqual({
      status: "ACTIVE",
      advancePeriod: false,
      markPastDue: false,
      clearPastDue: true
    });
  });

  it("cancelled -> CANCELLED", () => {
    expect(mapMpStatus("preapproval", "cancelled")?.status).toBe("CANCELLED");
  });

  it("paused -> PAST_DUE e marca início do atraso", () => {
    expect(mapMpStatus("preapproval", "paused")).toMatchObject({
      status: "PAST_DUE",
      markPastDue: true
    });
  });

  it("status desconhecido/pending -> null (ignora)", () => {
    expect(mapMpStatus("preapproval", "pending")).toBeNull();
  });
});

describe("mapMpStatus — payment recorrente", () => {
  it("approved -> ACTIVE e empurra o período", () => {
    expect(mapMpStatus("payment", "approved")).toEqual({
      status: "ACTIVE",
      advancePeriod: true,
      markPastDue: false,
      clearPastDue: true
    });
  });

  it("rejected -> PAST_DUE e marca início do atraso", () => {
    expect(mapMpStatus("payment", "rejected")).toMatchObject({
      status: "PAST_DUE",
      markPastDue: true,
      advancePeriod: false
    });
  });

  it("cancelled -> CANCELLED", () => {
    expect(mapMpStatus("payment", "cancelled")?.status).toBe("CANCELLED");
  });

  it("refunded e charged_back -> PAST_DUE", () => {
    expect(mapMpStatus("payment", "refunded")?.status).toBe("PAST_DUE");
    expect(mapMpStatus("payment", "charged_back")?.status).toBe("PAST_DUE");
  });

  it("status desconhecido -> null (ignora)", () => {
    expect(mapMpStatus("payment", "in_process")).toBeNull();
  });

  it("é case-insensitive e tolera espaços", () => {
    expect(mapMpStatus("payment", "  Approved ")?.status).toBe("ACTIVE");
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
