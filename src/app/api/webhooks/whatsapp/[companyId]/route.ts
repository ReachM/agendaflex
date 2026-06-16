import { AppointmentStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { ApiError, handleApiError, ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { resolvePlanFeatures } from "@/lib/security/plan-guard";
import { rateLimit } from "@/lib/security/rate-limit";
import { handleBookingMessage, hasActiveBooking } from "@/lib/services/bot-booking";
import { matchFaq } from "@/lib/services/bot-faq";
import { normalizePhone, sendTextMessage, type NormalizedPhone } from "@/lib/services/whatsapp";

type RouteContext = { params: Promise<{ companyId: string }> };

const LOG_PREFIX = "[Bot WhatsApp]";

/**
 * Payload do evento "Message" da WuzAPI. Estrutura toda opcional — fazemos
 * acesso defensivo e ignoramos o que não casar.
 */
type WuzapiWebhookBody = {
  event?: string;
  instanceId?: string | number;
  data?: {
    Info?: {
      MessageSource?: {
        Chat?: { User?: string; Server?: string };
        IsFromMe?: boolean;
        IsGroup?: boolean;
      };
      Type?: string;
    };
    Text?: { Body?: string };
    Message?: { conversation?: string };
  };
};

/**
 * Remove caracteres de controle (C0 + DEL), colapsa espaços e limita o tamanho
 * antes de usar/logar. Feito por código de caractere para não embutir bytes de
 * controle no fonte.
 */
function sanitizeText(raw: string): string {
  let cleaned = "";
  for (const char of raw) {
    const code = char.codePointAt(0) ?? 0;
    cleaned += code < 0x20 || code === 0x7f ? " " : char;
  }
  return cleaned.replace(/\s+/g, " ").trim().slice(0, 1000);
}

/** Telefone mascarado para log (sem expor o número completo — dado pessoal). */
function maskPhone(normalized: NormalizedPhone): string {
  return normalized.digits ? `***${normalized.digits.slice(-4)}` : "***";
}

function lastDigits(value: string, count = 8): string {
  return value.replace(/\D/g, "").slice(-count);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

/**
 * Busca o próximo agendamento SCHEDULED do telefone normalizado dentro do tenant.
 * Casa pelos últimos 8 dígitos (contorna a ambiguidade do 9º dígito BR).
 */
async function findScheduledAppointment(companyId: string, normalized: NormalizedPhone) {
  if (!normalized.digits) return null;
  const target = lastDigits(normalized.digits);
  if (target.length < 8) return null;

  const appointments = await prisma.appointment.findMany({
    where: {
      companyId,
      status: AppointmentStatus.SCHEDULED,
      startAt: { gte: new Date() }
    },
    select: {
      id: true,
      startAt: true,
      customer: { select: { phone: true, whatsapp: true } }
    },
    orderBy: { startAt: "asc" },
    take: 200
  });

  for (const appointment of appointments) {
    const phones = [appointment.customer?.phone, appointment.customer?.whatsapp].filter(
      (p): p is string => Boolean(p)
    );
    if (phones.some((phone) => lastDigits(phone) === target)) {
      return appointment;
    }
  }
  return null;
}

/** Confirma ("1") ou cancela ("2") o agendamento pendente do número. */
async function handleConfirmCancel(
  companyId: string,
  normalized: NormalizedPhone,
  choice: "1" | "2"
): Promise<string> {
  const mask = maskPhone(normalized);

  // @lid (anúncio) ou número inválido: não casa agendamento por número.
  if (!normalized.trusted || !normalized.valid) {
    return "Não encontrei nenhum agendamento pendente para este número.";
  }

  const appointment = await findScheduledAppointment(companyId, normalized);
  if (!appointment) {
    return "Não encontrei nenhum agendamento pendente para este número.";
  }

  if (choice === "1") {
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: AppointmentStatus.CONFIRMED }
    });
    console.log(`${LOG_PREFIX} agendamento confirmado company=${companyId} phone=${mask}`);
    return `✅ Agendamento confirmado! Te esperamos em ${formatDate(appointment.startAt)} às ${formatTime(appointment.startAt)}.`;
  }

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: AppointmentStatus.CANCELLED, canceledAt: new Date() }
  });
  console.log(`${LOG_PREFIX} agendamento cancelado company=${companyId} phone=${mask}`);
  return "Agendamento cancelado. Para reagendar, é só chamar por aqui.";
}

const FALLBACK_MESSAGE = [
  "Olá! 👋 Sou o assistente virtual.",
  "Posso te ajudar com:",
  "• Digite *1* para confirmar seu agendamento",
  "• Digite *2* para cancelar",
  "Ou envie sua dúvida que eu tento responder por aqui."
].join("\n");

/**
 * Roteamento por prioridade:
 * 1) comandos "1"/"2" (confirmar/cancelar) — exceto quando há um fluxo de
 *    agendamento ativo, pois aí os números são as opções do menu do bot.
 * 2) fluxo de agendamento (em andamento ou iniciado por palavra-chave)
 * 3) FAQ
 * 4) fallback amigável
 */
async function routeMessage(params: {
  companyId: string;
  normalized: NormalizedPhone;
  remoteJid: string;
  text: string;
  faqConfig: unknown;
}): Promise<string> {
  const { companyId, normalized, remoteJid, text, faqConfig } = params;
  const trimmed = text.trim();

  // 1) Confirmação / cancelamento (só fora de um fluxo de agendamento ativo).
  if (trimmed === "1" || trimmed === "2") {
    if (!(await hasActiveBooking(companyId, remoteJid))) {
      return handleConfirmCancel(companyId, normalized, trimmed);
    }
  }

  // 2) Fluxo de agendamento (BotConversationState). Retorna null se a mensagem
  //    não é de agendamento — aí seguimos para FAQ/fallback.
  const bookingReply = await handleBookingMessage({ companyId, remoteJid, text });
  if (bookingReply !== null) return bookingReply;

  // 3) FAQ.
  const faqAnswer = matchFaq(trimmed, faqConfig);
  if (faqAnswer) return faqAnswer;

  // 4) Fallback amigável.
  return FALLBACK_MESSAGE;
}

/**
 * POST /api/webhooks/whatsapp/:companyId
 *
 * Recebe o evento "Message" da WuzAPI (webhook por empresa, configurado em
 * createInstance). A WuzAPI não envia eventos de QR/conexão — o QR é obtido
 * sob demanda via GET /session/qr.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { companyId } = await context.params;

    // Rate limiting (helper já existente no projeto).
    rateLimit(`whatsapp-webhook:${companyId}`, 600, 60_000);

    // Validação OPCIONAL: a WuzAPI não envia x-webhook-token. Só rejeitamos
    // quando WHATSAPP_WEBHOOK_TOKEN está definido E veio um header divergente.
    const expected = process.env.WHATSAPP_WEBHOOK_TOKEN;
    const provided = request.headers.get("x-webhook-token");
    if (expected && provided && provided !== expected) {
      throw new ApiError(401, "Webhook não autorizado.");
    }

    const raw = await request.json().catch(() => null);
    if (!raw || typeof raw !== "object") {
      return ok({ received: true, ignored: true });
    }

    const body = raw as WuzapiWebhookBody;

    // A WuzAPI assina apenas o evento "Message" — demais eventos são ignorados.
    if (body.event !== "Message") {
      return ok({ received: true, ignored: true });
    }

    const data = body.data ?? {};
    const source = data.Info?.MessageSource;
    const fromMe = source?.IsFromMe ?? false;
    const isGroup = source?.IsGroup ?? false;
    const user = source?.Chat?.User;
    const rawText = data.Text?.Body ?? data.Message?.conversation ?? "";

    // Ignora: mensagens do próprio bot (loop), grupos, ou sem remetente/texto.
    if (fromMe || isGroup || !user) {
      return ok({ received: true, ignored: true });
    }
    const text = sanitizeText(rawText);
    if (!text) {
      return ok({ received: true, ignored: true });
    }
    const remoteJid = `${user}@s.whatsapp.net`;

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        botEnabled: true,
        botConfiguration: { select: { faqConfig: true } }
      }
    });

    // Empresa inexistente -> 200 e ignora (não vaza existência via status).
    if (!company) {
      return ok({ received: true, ignored: true });
    }

    // Bot desligado para a empresa -> 200 e ignora.
    if (!company.botEnabled) {
      return ok({ received: true, ignored: true });
    }

    // Plano sem o recurso -> ignora (uso sem plano).
    const features = await resolvePlanFeatures(companyId);
    if (!features.allowBotIntegration) {
      console.warn(`${LOG_PREFIX} uso sem plano company=${companyId}`);
      return ok({ received: true, ignored: true });
    }

    const normalized = normalizePhone(remoteJid);
    const mask = maskPhone(normalized);
    console.log(`${LOG_PREFIX} mensagem recebida company=${companyId} phone=${mask} chars=${text.length}`);

    const reply = await routeMessage({
      companyId,
      normalized,
      remoteJid,
      text,
      faqConfig: company.botConfiguration?.faqConfig
    });

    // Envia a resposta (best-effort). Sem número válido (ex.: @lid) não há como responder.
    if (normalized.digits) {
      try {
        await sendTextMessage(companyId, normalized.e164 ?? normalized.digits, reply);
      } catch (error) {
        const message = error instanceof Error ? error.message : "erro desconhecido";
        console.error(`${LOG_PREFIX} falha de envio company=${companyId} phone=${mask}: ${message}`);
      }
    } else {
      console.warn(`${LOG_PREFIX} sem número válido para responder company=${companyId} phone=${mask}`);
    }

    return ok({ received: true });
  } catch (error) {
    return handleApiError(error);
  }
}
