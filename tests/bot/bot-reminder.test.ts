import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    appointment: { findMany: vi.fn() },
    sentReminder: { findUnique: vi.fn(), create: vi.fn() }
  } as any
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/security/plan-guard", () => ({ resolvePlanFeatures: vi.fn() }));
vi.mock("@/lib/services/whatsapp", () => ({ sendTextMessage: vi.fn() }));

import { processReminders } from "@/lib/services/bot-reminder";
import { resolvePlanFeatures } from "@/lib/security/plan-guard";
import { sendTextMessage } from "@/lib/services/whatsapp";

const planMock = vi.mocked(resolvePlanFeatures);
const sendMock = vi.mocked(sendTextMessage);

function makeAppointment(overrides: Record<string, any> = {}) {
  return {
    id: "appt-1",
    companyId: "company-1",
    startAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    customer: { name: "João", phone: "5511999990000", whatsapp: null },
    service: { name: "Corte" },
    professional: { name: "Maria" },
    company: {
      botEnabled: true,
      botConfiguration: { reminderConfig: { enabled: true, send24h: true, send2h: true } }
    },
    ...overrides
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  planMock.mockResolvedValue({ allowBotIntegration: true } as any);
  sendMock.mockResolvedValue(undefined as any);
});

describe("Bot Reminder — processReminders", () => {
  it("NÃO envia quando Company.botEnabled é false", async () => {
    const appt = makeAppointment({
      company: { botEnabled: false, botConfiguration: { reminderConfig: { enabled: true, send24h: true, send2h: true } } }
    });
    prismaMock.appointment.findMany.mockResolvedValue([appt]);

    await processReminders({ now: new Date(), intervalMinutes: 15 });

    expect(sendMock).not.toHaveBeenCalled();
    expect(prismaMock.sentReminder.create).not.toHaveBeenCalled();
  });

  it("NÃO reenvia quando já existe SentReminder (idempotência)", async () => {
    prismaMock.appointment.findMany.mockResolvedValue([makeAppointment()]);
    prismaMock.sentReminder.findUnique.mockResolvedValue({ id: "sent-1" }); // já enviado

    await processReminders({ now: new Date(), intervalMinutes: 15 });

    expect(sendMock).not.toHaveBeenCalled();
    expect(prismaMock.sentReminder.create).not.toHaveBeenCalled();
  });

  it("envia e registra SentReminder quando elegível e ainda não enviado", async () => {
    // Apenas a janela de 24h tem o agendamento; a de 2h fica vazia.
    prismaMock.appointment.findMany
      .mockResolvedValueOnce([makeAppointment()])
      .mockResolvedValueOnce([]);
    prismaMock.sentReminder.findUnique.mockResolvedValue(null);
    prismaMock.sentReminder.create.mockResolvedValue({ id: "sent-1" });

    const result = await processReminders({ now: new Date(), intervalMinutes: 15 });

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(prismaMock.sentReminder.create).toHaveBeenCalledTimes(1);
    expect(result.sent).toBe(1);
  });
});
