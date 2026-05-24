import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    company: { findUnique: vi.fn() },
    companyBotConfig: { findUnique: vi.fn() },
    botConversationState: { findUnique: vi.fn() },
    appointment: { findMany: vi.fn(), update: vi.fn() }
  } as any
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/security/plan-guard", () => ({ resolvePlanFeatures: vi.fn() }));
// Mantém o normalizePhone real; só intercepta o envio para a Evolution.
vi.mock("@/lib/services/whatsapp", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/whatsapp")>();
  return { ...actual, sendTextMessage: vi.fn() };
});

import { POST } from "@/app/api/webhooks/whatsapp/[companyId]/route";
import { resolvePlanFeatures } from "@/lib/security/plan-guard";
import { sendTextMessage } from "@/lib/services/whatsapp";

const planMock = vi.mocked(resolvePlanFeatures);
const sendMock = vi.mocked(sendTextMessage);

const TOKEN = "test-webhook-token";
const PHONE_JID = "5511977778888@s.whatsapp.net";

function makeRequest(headers: Record<string, string>, body: unknown) {
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = v;
  return {
    headers: { get: (key: string) => lower[key.toLowerCase()] ?? null },
    json: async () => body
  } as any;
}

const ctx = { params: Promise.resolve({ companyId: "company-1" }) };

function upsertBody(extra: Record<string, any> = {}, message: Record<string, any> = { conversation: "oi" }) {
  return {
    event: "messages.upsert",
    instance: "inst-1",
    data: {
      key: { remoteJid: PHONE_JID, fromMe: false, id: "msg-1" },
      pushName: "Fulano",
      message,
      instanceId: "uuid-1"
    },
    ...extra
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  process.env.WHATSAPP_WEBHOOK_TOKEN = TOKEN;
  planMock.mockResolvedValue({ allowBotIntegration: true } as any);
  sendMock.mockResolvedValue(undefined as any);
  prismaMock.company.findUnique.mockResolvedValue({
    botEnabled: true,
    botConfiguration: { whatsappInstance: "inst-1", faqConfig: [] }
  });
  prismaMock.companyBotConfig.findUnique.mockResolvedValue({ allowBooking: false });
  prismaMock.botConversationState.findUnique.mockResolvedValue(null);
  prismaMock.appointment.update.mockResolvedValue({});
});

describe("Webhook WhatsApp — segurança", () => {
  it("rejeita sem header de token válido (401)", async () => {
    const res = await POST(makeRequest({ "x-webhook-token": "errado" }, upsertBody()), ctx);
    expect(res.status).toBe(401);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("rejeita quando o header de token está ausente (401)", async () => {
    const res = await POST(makeRequest({}, upsertBody()), ctx);
    expect(res.status).toBe(401);
  });

  it("rejeita quando o companyId do path não bate com a instância (403)", async () => {
    prismaMock.company.findUnique.mockResolvedValue({
      botEnabled: true,
      botConfiguration: { whatsappInstance: "outra-instancia", faqConfig: [] }
    });
    const res = await POST(makeRequest({ "x-webhook-token": TOKEN }, upsertBody({ instance: "inst-1" })), ctx);
    expect(res.status).toBe(403);
    expect(sendMock).not.toHaveBeenCalled();
  });
});

describe("Webhook WhatsApp — mensagens", () => {
  it("ignora fromMe=true (sem loop, não responde)", async () => {
    const body = upsertBody({}, { conversation: "oi" });
    body.data.key.fromMe = true;
    const res = await POST(makeRequest({ "x-webhook-token": TOKEN }, body), ctx);
    expect(res.status).toBe(200);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("extrai o texto de data.message.conversation", async () => {
    const res = await POST(
      makeRequest({ "x-webhook-token": TOKEN }, upsertBody({}, { conversation: "oi" })),
      ctx
    );
    expect(res.status).toBe(200);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(typeof sendMock.mock.calls[0][2]).toBe("string");
    expect((sendMock.mock.calls[0][2] as string).length).toBeGreaterThan(0);
  });

  it("extrai o texto de data.message.extendedTextMessage.text", async () => {
    const res = await POST(
      makeRequest({ "x-webhook-token": TOKEN }, upsertBody({}, { extendedTextMessage: { text: "oi" } })),
      ctx
    );
    expect(res.status).toBe(200);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect((sendMock.mock.calls[0][2] as string).length).toBeGreaterThan(0);
  });

  it("retorna a resposta do FAQ configurado", async () => {
    prismaMock.company.findUnique.mockResolvedValue({
      botEnabled: true,
      botConfiguration: {
        whatsappInstance: "inst-1",
        faqConfig: [{ pergunta: "Qual o horário de funcionamento?", resposta: "Seg a Sex, 8h às 18h." }]
      }
    });
    const res = await POST(
      makeRequest({ "x-webhook-token": TOKEN }, upsertBody({}, { conversation: "qual o horario de funcionamento?" })),
      ctx
    );
    expect(res.status).toBe(200);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][2]).toBe("Seg a Sex, 8h às 18h.");
  });
});

describe("Webhook WhatsApp — confirmação/cancelamento", () => {
  function scheduledAppt() {
    return [
      {
        id: "appt-1",
        startAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        customer: { phone: "5511977778888", whatsapp: null }
      }
    ];
  }

  it('"1" muda o agendamento de SCHEDULED para CONFIRMED', async () => {
    prismaMock.appointment.findMany.mockResolvedValue(scheduledAppt());

    const res = await POST(makeRequest({ "x-webhook-token": TOKEN }, upsertBody({}, { conversation: "1" })), ctx);

    expect(res.status).toBe(200);
    expect(prismaMock.appointment.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.appointment.update.mock.calls[0][0]).toMatchObject({
      where: { id: "appt-1" },
      data: { status: "CONFIRMED" }
    });
  });

  it('"2" muda o agendamento de SCHEDULED para CANCELLED', async () => {
    prismaMock.appointment.findMany.mockResolvedValue(scheduledAppt());

    const res = await POST(makeRequest({ "x-webhook-token": TOKEN }, upsertBody({}, { conversation: "2" })), ctx);

    expect(res.status).toBe(200);
    expect(prismaMock.appointment.update).toHaveBeenCalledTimes(1);
    const arg = prismaMock.appointment.update.mock.calls[0][0];
    expect(arg.where).toEqual({ id: "appt-1" });
    expect(arg.data.status).toBe("CANCELLED");
    expect(arg.data.canceledAt).toBeInstanceOf(Date);
  });
});
