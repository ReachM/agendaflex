import { describe, expect, it } from "vitest";

import {
  addMonths,
  calculateCommissionAmount,
  isWithinCommissionWindow,
  pickCommissionTier,
  referenceMonthOf,
  type CommissionTierLike
} from "@/lib/services/commissions";

// Faixas do seed: 1-10 → 5%, 11-30 → 8%, 31+ → 12%.
const TIERS: CommissionTierLike[] = [
  { minSubscribers: 1, maxSubscribers: 10, commissionPct: 5 },
  { minSubscribers: 11, maxSubscribers: 30, commissionPct: 8 },
  { minSubscribers: 31, maxSubscribers: null, commissionPct: 12 }
];

describe("pickCommissionTier", () => {
  it("bordas de cada faixa", () => {
    expect(pickCommissionTier(1, TIERS)?.commissionPct).toBe(5);
    expect(pickCommissionTier(10, TIERS)?.commissionPct).toBe(5);
    expect(pickCommissionTier(11, TIERS)?.commissionPct).toBe(8);
    expect(pickCommissionTier(30, TIERS)?.commissionPct).toBe(8);
    expect(pickCommissionTier(31, TIERS)?.commissionPct).toBe(12);
  });

  it("faixa sem limite superior (maxSubscribers=null) cobre valores altos", () => {
    expect(pickCommissionTier(1000, TIERS)?.commissionPct).toBe(12);
  });

  it("0 assinantes -> nenhuma faixa (a menor começa em 1)", () => {
    expect(pickCommissionTier(0, TIERS)).toBeNull();
  });

  it("lista vazia -> null", () => {
    expect(pickCommissionTier(5, [])).toBeNull();
  });

  it("independe da ordem de entrada das faixas", () => {
    const shuffled = [TIERS[2], TIERS[0], TIERS[1]];
    expect(pickCommissionTier(15, shuffled)?.commissionPct).toBe(8);
  });
});

describe("calculateCommissionAmount", () => {
  it("aplica o percentual", () => {
    expect(calculateCommissionAmount(100, 5)).toBe(5);
    expect(calculateCommissionAmount(200, 8)).toBe(16);
    expect(calculateCommissionAmount(49.9, 12)).toBe(5.99);
  });

  it("arredonda a 2 casas (half-up)", () => {
    // 79.9 * 5% = 3.995 -> 4.00
    expect(calculateCommissionAmount(79.9, 5)).toBe(4);
    // 33.33 * 8% = 2.6664 -> 2.67
    expect(calculateCommissionAmount(33.33, 8)).toBe(2.67);
  });

  it("pct 0 ou valor 0 -> 0", () => {
    expect(calculateCommissionAmount(100, 0)).toBe(0);
    expect(calculateCommissionAmount(0, 12)).toBe(0);
  });

  it("entradas não finitas -> 0", () => {
    expect(calculateCommissionAmount(Number.NaN, 5)).toBe(0);
    expect(calculateCommissionAmount(100, Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("addMonths / isWithinCommissionWindow", () => {
  it("addMonths soma meses", () => {
    expect(addMonths(new Date("2026-01-15T00:00:00Z"), 12).toISOString()).toBe(
      "2027-01-15T00:00:00.000Z"
    );
  });

  it("dentro da janela de 12 meses -> true", () => {
    const created = new Date("2026-01-01T00:00:00Z");
    const now = new Date("2026-12-01T00:00:00Z");
    expect(isWithinCommissionWindow(created, 12, now)).toBe(true);
  });

  it("no exato fim da janela -> ainda true (<=)", () => {
    const created = new Date("2026-01-01T00:00:00Z");
    const now = new Date("2027-01-01T00:00:00Z");
    expect(isWithinCommissionWindow(created, 12, now)).toBe(true);
  });

  it("depois da janela -> false", () => {
    const created = new Date("2026-01-01T00:00:00Z");
    const now = new Date("2027-01-02T00:00:00Z");
    expect(isWithinCommissionWindow(created, 12, now)).toBe(false);
  });
});

describe("referenceMonthOf", () => {
  it("formata YYYY-MM com zero à esquerda", () => {
    expect(referenceMonthOf(new Date("2026-07-01T12:00:00Z"))).toBe("2026-07");
    expect(referenceMonthOf(new Date("2026-11-30T23:00:00Z"))).toBe("2026-11");
  });
});
