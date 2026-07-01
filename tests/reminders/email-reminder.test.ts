import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, sendMock } = vi.hoisted(() => ({
  prismaMock: {
    appointment: { findMany: vi.fn(), updateMany: vi.fn() }
  } as any,
  sendMock: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/services/notifications", () => ({
  sendAppointmentReminderEmail: (...args: unknown[]) => sendMock(...args)
}));

import { processEmailReminders, reminderBand } from "@/lib/services/appointment-reminder";

function appt(overrides: Record<string, unknown> = {}) {
  return {
    id: "a1",
    startAt: new Date("2026-07-02T12:00:00Z"),
    customer: { name: "Ana", email: "ana@example.com" },
    service: { name: "Corte" },
    professional: { name: "João" },
    company: { name: "Salão Bella", tradeName: null, phone: "(11) 99999-0000", slug: "salao-bella" },
    ...overrides
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.appointment.updateMany.mockResolvedValue({ count: 1 });
});

describe("reminderBand", () => {
  it("gera a banda [now+h, now+h+interval)", () => {
    const now = new Date("2026-07-01T12:00:00Z");
    const { lower, upper } = reminderBand(now, 24, 15);
    expect(lower.toISOString()).toBe("2026-07-02T12:00:00.000Z");
    expect(upper.toISOString()).toBe("2026-07-02T12:15:00.000Z");
  });

  it("janela de 2h", () => {
    const now = new Date("2026-07-01T12:00:00Z");
    const { lower, upper } = reminderBand(now, 2, 15);
    expect(lower.toISOString()).toBe("2026-07-01T14:00:00.000Z");
    expect(upper.toISOString()).toBe("2026-07-01T14:15:00.000Z");
  });
});

describe("processEmailReminders", () => {
  it("envia o lembrete 24h e marca a coluna só após sucesso", async () => {
    prismaMock.appointment.findMany.mockResolvedValueOnce([appt()]).mockResolvedValueOnce([]);
    sendMock.mockResolvedValue(undefined);

    const res = await processEmailReminders({ now: new Date("2026-07-01T12:00:00Z") });

    expect(res).toEqual({ sent: 1, skipped: 0, failed: 0 });
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0]).toBe("24h");
    expect(sendMock.mock.calls[0][1]).toBe("ana@example.com");
    expect(sendMock.mock.calls[0][2]).toMatchObject({
      customerName: "Ana",
      companyName: "Salão Bella",
      serviceName: "Corte",
      professionalName: "João",
      bookingUrl: expect.stringContaining("/agendar/salao-bella")
    });

    expect(prismaMock.appointment.updateMany).toHaveBeenCalledTimes(1);
    const call = prismaMock.appointment.updateMany.mock.calls[0][0];
    expect(call.where).toMatchObject({ id: "a1", reminder24hSentAt: null });
    expect(call.data).toHaveProperty("reminder24hSentAt");
  });

  it("NÃO marca a coluna quando o envio falha (permite retry no próximo ciclo)", async () => {
    prismaMock.appointment.findMany.mockResolvedValueOnce([appt()]).mockResolvedValueOnce([]);
    sendMock.mockRejectedValue(new Error("provider down"));

    const res = await processEmailReminders({ now: new Date("2026-07-01T12:00:00Z") });

    expect(res).toEqual({ sent: 0, skipped: 0, failed: 1 });
    expect(prismaMock.appointment.updateMany).not.toHaveBeenCalled();
  });

  it("pula agendamento sem e-mail sem tentar enviar", async () => {
    prismaMock.appointment.findMany
      .mockResolvedValueOnce([appt({ customer: { name: "Sem Email", email: null } })])
      .mockResolvedValueOnce([]);

    const res = await processEmailReminders({ now: new Date("2026-07-01T12:00:00Z") });

    expect(res.skipped).toBe(1);
    expect(res.sent).toBe(0);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("usa tradeName como nome do salão quando presente", async () => {
    prismaMock.appointment.findMany
      .mockResolvedValueOnce([appt({ company: { name: "Razão Social LTDA", tradeName: "Bella", phone: null, slug: null } })])
      .mockResolvedValueOnce([]);
    sendMock.mockResolvedValue(undefined);

    await processEmailReminders({ now: new Date("2026-07-01T12:00:00Z") });

    expect(sendMock.mock.calls[0][2]).toMatchObject({ companyName: "Bella", bookingUrl: null });
  });

  it("filtra por coluna nula, status ativo e e-mail presente nas duas janelas", async () => {
    prismaMock.appointment.findMany.mockResolvedValue([]);

    await processEmailReminders({ now: new Date("2026-07-01T12:00:00Z") });

    expect(prismaMock.appointment.findMany).toHaveBeenCalledTimes(2);

    const where24 = prismaMock.appointment.findMany.mock.calls[0][0].where;
    expect(where24).toHaveProperty("reminder24hSentAt", null);
    expect(where24.customer).toEqual({ email: { not: null } });
    expect(where24.status).toEqual({ in: ["SCHEDULED", "CONFIRMED"] });

    const where2 = prismaMock.appointment.findMany.mock.calls[1][0].where;
    expect(where2).toHaveProperty("reminder2hSentAt", null);
  });
});
