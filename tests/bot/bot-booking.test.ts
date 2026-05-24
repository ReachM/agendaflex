import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    companyBotConfig: { findUnique: vi.fn() },
    botConversationState: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
    appointment: { findFirst: vi.fn(), create: vi.fn() },
    customer: { findFirst: vi.fn(), create: vi.fn() },
    service: { findFirst: vi.fn() },
    $transaction: vi.fn()
  } as any
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { handleBookingMessage } from "@/lib/services/bot-booking";

const COMPANY = "company-1";
const JID = "5511999990000@s.whatsapp.net";

function awaitingNameState() {
  const start = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  start.setHours(10, 0, 0, 0);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  return {
    step: "AWAITING_NAME",
    context: {
      stage: "name",
      phone: "5511999990000",
      serviceId: "svc-1",
      serviceName: "Corte",
      professionalId: "prof-1",
      professionalName: "Maria",
      startAt: start.toISOString(),
      endAt: end.toISOString()
    }
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  prismaMock.$transaction.mockImplementation(async (cb: any) => cb(prismaMock));
  prismaMock.botConversationState.deleteMany.mockResolvedValue({ count: 1 });
  prismaMock.botConversationState.upsert.mockResolvedValue({});
});

describe("Bot Booking — gating allowBooking", () => {
  it("NÃO cria agendamento quando allowBooking é false", async () => {
    prismaMock.botConversationState.findUnique.mockResolvedValue(awaitingNameState());
    prismaMock.companyBotConfig.findUnique.mockResolvedValue({ allowBooking: false });

    const reply = await handleBookingMessage({ companyId: COMPANY, remoteJid: JID, text: "João Silva" });

    expect(reply).toContain("desativado");
    expect(prismaMock.appointment.create).not.toHaveBeenCalled();
  });
});

describe("Bot Booking — criação", () => {
  it("cria o agendamento com source=BOT quando allowBooking é true", async () => {
    prismaMock.botConversationState.findUnique.mockResolvedValue(awaitingNameState());
    prismaMock.companyBotConfig.findUnique.mockResolvedValue({ allowBooking: true });
    prismaMock.appointment.findFirst.mockResolvedValue(null); // sem conflito
    prismaMock.customer.create.mockResolvedValue({ id: "cust-1", name: "João Silva" });
    prismaMock.service.findFirst.mockResolvedValue({ id: "svc-1", name: "Corte", basePrice: null });
    prismaMock.appointment.create.mockResolvedValue({ id: "appt-1" });

    const reply = await handleBookingMessage({ companyId: COMPANY, remoteJid: JID, text: "João Silva" });

    expect(prismaMock.appointment.create).toHaveBeenCalledTimes(1);
    const data = prismaMock.appointment.create.mock.calls[0][0].data;
    expect(data.source).toBe("BOT");
    expect(data.status).toBe("SCHEDULED");
    expect(data.companyId).toBe(COMPANY);
    expect(data.professionalId).toBe("prof-1");
    expect(reply.toLowerCase()).toContain("confirmado");
    // Estado da conversa é limpo ao concluir.
    expect(prismaMock.botConversationState.deleteMany).toHaveBeenCalled();
  });
});
