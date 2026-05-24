import { AppointmentSource, AppointmentStatus, BotConversationStep, Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { ensureNoConflict, getAvailableSlots } from "@/lib/services/availability";
import { normalizePhone } from "@/lib/services/whatsapp";

/**
 * Agendamento por WhatsApp como máquina de estados persistida em
 * BotConversationState (NUNCA em memória — cada webhook é stateless).
 *
 * Fluxo: serviço -> data -> horário (disponibilidade real do sistema) ->
 * nome (se cliente novo) -> cria Appointment (source=BOT, status=SCHEDULED).
 *
 * Disponibilidade e conflito vêm de src/lib/services/availability.ts — a mesma
 * lógica da página pública. Aqui nada é inventado.
 */

const LOG_PREFIX = "[Bot Booking]";

const TRIGGER_WORDS = ["agendar", "agendamento", "marcar", "remarcar"];
const CANCEL_WORDS = ["cancelar", "parar", "sair", "desistir"];

type ServiceOption = { id: string; name: string };
type SlotOption = {
  time: string;
  startAt: string;
  endAt: string;
  professionalId: string;
  professionalName: string;
};
type BookingStage = "phone" | "name";

type BookingContext = {
  serviceOptions?: ServiceOption[];
  serviceId?: string;
  serviceName?: string;
  date?: string; // YYYY-MM-DD
  slotOptions?: SlotOption[];
  professionalId?: string;
  professionalName?: string;
  startAt?: string; // ISO
  endAt?: string; // ISO
  slotLabel?: string;
  phone?: string; // dígitos confirmados
  stage?: BookingStage;
};

// ─── helpers de texto ───────────────────────────────

function stripAccentsLower(text: string): string {
  let out = "";
  for (const char of text.toLowerCase().normalize("NFD")) {
    const code = char.codePointAt(0) ?? 0;
    if (code >= 0x300 && code <= 0x36f) continue; // marcas diacríticas
    out += char;
  }
  return out;
}

function isBookingTrigger(text: string): boolean {
  const norm = stripAccentsLower(text);
  return TRIGGER_WORDS.some((word) => norm.includes(word));
}

function isCancelWord(text: string): boolean {
  return CANCEL_WORDS.includes(stripAccentsLower(text).trim());
}

function parseChoice(text: string, length: number): number | null {
  const match = text.trim().match(/^(\d{1,3})/);
  if (!match) return null;
  const n = Number(match[1]);
  if (!Number.isInteger(n) || n < 1 || n > length) return null;
  return n;
}

/** Aceita DD/MM ou DD/MM/AAAA; sem ano, assume o ano atual (rola p/ o próximo se já passou). */
function parseDateBR(text: string): string | null {
  const match = text.trim().match(/^(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = match[3] ? Number(match[3]) : new Date().getFullYear();
  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;

  if (!match[3]) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) year += 1;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function sanitizeName(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 80);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatDateLabel(date: string): string {
  return formatDate(new Date(`${date}T00:00:00`));
}

function exampleDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function listServices(ctx: BookingContext): string {
  return (ctx.serviceOptions ?? []).map((o, i) => `${i + 1}) ${o.name}`).join("\n");
}

function listSlots(ctx: BookingContext): string {
  return (ctx.slotOptions ?? []).map((o, i) => `${i + 1}) ${o.time} — ${o.professionalName}`).join("\n");
}

// ─── estado (BotConversationState) ──────────────────

/** Chave estável da conversa: dígitos do telefone, ou parte local do JID (@lid). */
function conversationPhone(remoteJid: string): string {
  const normalized = normalizePhone(remoteJid);
  if (normalized.digits) return normalized.digits;
  const local = remoteJid.split("@")[0].replace(/[^a-zA-Z0-9]/g, "");
  return local || remoteJid;
}

async function saveState(companyId: string, phone: string, step: BotConversationStep, context: BookingContext) {
  await prisma.botConversationState.upsert({
    where: { companyId_phone: { companyId, phone } },
    create: { companyId, phone, step, context: context as Prisma.InputJsonValue },
    update: { step, context: context as Prisma.InputJsonValue }
  });
}

async function clearState(companyId: string, phone: string) {
  await prisma.botConversationState.deleteMany({ where: { companyId, phone } });
}

async function findCustomerByPhone(companyId: string, digits: string) {
  const last8 = digits.slice(-8);
  if (last8.length < 8) return null;
  return prisma.customer.findFirst({
    where: {
      companyId,
      deletedAt: null,
      OR: [{ phone: { contains: last8 } }, { whatsapp: { contains: last8 } }]
    },
    select: { id: true, name: true }
  });
}

// ─── passos do fluxo ────────────────────────────────

async function startBooking(companyId: string, phoneKey: string): Promise<string> {
  const services = await prisma.service.findMany({
    where: { companyId, isActive: true },
    orderBy: { name: "asc" },
    take: 10,
    select: { id: true, name: true }
  });

  if (services.length === 0) {
    await clearState(companyId, phoneKey);
    return "No momento não há serviços disponíveis para agendamento. 🙏 Fale com a nossa equipe.";
  }

  const serviceOptions: ServiceOption[] = services.map((s) => ({ id: s.id, name: s.name }));
  await saveState(companyId, phoneKey, BotConversationStep.AWAITING_SERVICE, { serviceOptions });

  return (
    "Vamos agendar! 📅\nEscolha o serviço respondendo com o número:\n" +
    serviceOptions.map((o, i) => `${i + 1}) ${o.name}`).join("\n")
  );
}

async function handleServiceChoice(companyId: string, phoneKey: string, text: string, ctx: BookingContext): Promise<string> {
  const choice = parseChoice(text, ctx.serviceOptions?.length ?? 0);
  if (choice === null) {
    return "Não entendi. 🤔 Responda com o número do serviço:\n" + listServices(ctx);
  }
  const selected = ctx.serviceOptions![choice - 1];
  await saveState(companyId, phoneKey, BotConversationStep.AWAITING_DATE, {
    ...ctx,
    serviceId: selected.id,
    serviceName: selected.name
  });
  return `Ótimo, *${selected.name}*! 📅\nPara qual data? Envie no formato DD/MM (ex: ${exampleDate()}).`;
}

async function presentSlots(companyId: string, phoneKey: string, ctx: BookingContext, date: string): Promise<string> {
  const professionals = await prisma.professional.findMany({
    where: { companyId, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true }
  });

  if (professionals.length === 0) {
    await clearState(companyId, phoneKey);
    return "Não há profissionais disponíveis para agendamento no momento. 🙏 Fale com a nossa equipe.";
  }

  const options: SlotOption[] = [];
  for (const professional of professionals) {
    try {
      const result = await getAvailableSlots({
        companyId,
        serviceId: ctx.serviceId!,
        professionalId: professional.id,
        date
      });
      for (const slot of result.slots) {
        options.push({
          time: slot.time,
          startAt: slot.startAt,
          endAt: slot.endAt,
          professionalId: professional.id,
          professionalName: professional.name
        });
      }
    } catch {
      // serviço/profissional indisponível para este caso — ignora e segue.
    }
  }

  options.sort((a, b) => (a.startAt < b.startAt ? -1 : a.startAt > b.startAt ? 1 : 0));
  const limited = options.slice(0, 8);

  if (limited.length === 0) {
    await saveState(companyId, phoneKey, BotConversationStep.AWAITING_DATE, { ...ctx, date });
    return `Não encontrei horários livres em ${formatDateLabel(date)}. 😕\nQuer tentar outra data? Envie no formato DD/MM.`;
  }

  await saveState(companyId, phoneKey, BotConversationStep.AWAITING_SLOT, { ...ctx, date, slotOptions: limited });
  return (
    `Horários disponíveis em ${formatDateLabel(date)}:\n` +
    limited.map((o, i) => `${i + 1}) ${o.time} — ${o.professionalName}`).join("\n") +
    "\n\nResponda com o número do horário."
  );
}

async function handleDateChoice(companyId: string, phoneKey: string, text: string, ctx: BookingContext): Promise<string> {
  const date = parseDateBR(text);
  if (!date) {
    return `Data inválida. 😅 Envie no formato DD/MM (ex: ${exampleDate()}).`;
  }
  return presentSlots(companyId, phoneKey, ctx, date);
}

async function handleSlotChoice(
  companyId: string,
  phoneKey: string,
  text: string,
  ctx: BookingContext,
  normalizedTrusted: boolean,
  normalizedDigits: string | null
): Promise<string> {
  const choice = parseChoice(text, ctx.slotOptions?.length ?? 0);
  if (choice === null) {
    return "Não entendi. 🤔 Responda com o número do horário:\n" + listSlots(ctx);
  }

  const slot = ctx.slotOptions![choice - 1];
  const baseCtx: BookingContext = {
    ...ctx,
    professionalId: slot.professionalId,
    professionalName: slot.professionalName,
    startAt: slot.startAt,
    endAt: slot.endAt,
    slotLabel: slot.time
  };

  // JID @lid (número não confiável) ou inválido: confirma o telefone antes de criar.
  if (!normalizedTrusted || !normalizedDigits) {
    await saveState(companyId, phoneKey, BotConversationStep.AWAITING_NAME, { ...baseCtx, stage: "phone" });
    return "Quase lá! 📲 Para confirmar, me envie o seu número de WhatsApp com DDD (ex: 11 91234-5678).";
  }

  const customer = await findCustomerByPhone(companyId, normalizedDigits);
  if (customer) {
    return finalizeBooking(companyId, phoneKey, { ...baseCtx, phone: normalizedDigits }, customer.id, customer.name);
  }

  await saveState(companyId, phoneKey, BotConversationStep.AWAITING_NAME, { ...baseCtx, phone: normalizedDigits, stage: "name" });
  return "Quase lá! 😊 Qual é o seu nome?";
}

async function handleNameOrPhone(companyId: string, phoneKey: string, text: string, ctx: BookingContext): Promise<string> {
  const stage = ctx.stage ?? "name";

  if (stage === "phone") {
    const normalized = normalizePhone(text);
    if (!normalized.valid || !normalized.digits) {
      return "Número inválido. 😅 Envie com DDD, ex: 11 91234-5678.";
    }
    const customer = await findCustomerByPhone(companyId, normalized.digits);
    if (customer) {
      return finalizeBooking(companyId, phoneKey, { ...ctx, phone: normalized.digits }, customer.id, customer.name);
    }
    await saveState(companyId, phoneKey, BotConversationStep.AWAITING_NAME, { ...ctx, phone: normalized.digits, stage: "name" });
    return "Perfeito! 😊 E qual é o seu nome?";
  }

  const name = sanitizeName(text);
  if (name.length < 2 || /^\d+$/.test(name)) {
    return "Por favor, me diga o seu nome. 🙂";
  }
  if (!ctx.phone) {
    await clearState(companyId, phoneKey);
    return "Tive um problema com o seu número. 😕 Vamos recomeçar? Diga *agendar*.";
  }
  return finalizeBooking(companyId, phoneKey, ctx, null, name);
}

async function finalizeBooking(
  companyId: string,
  phoneKey: string,
  ctx: BookingContext,
  existingCustomerId: string | null,
  name: string
): Promise<string> {
  const startAt = new Date(ctx.startAt!);
  const endAt = new Date(ctx.endAt!);

  try {
    const appointment = await prisma.$transaction(async (tx) => {
      await ensureNoConflict(
        { companyId, professionalId: ctx.professionalId!, startAt, endAt },
        tx,
        "Horário indisponível."
      );

      let customerId = existingCustomerId;
      if (!customerId) {
        const customer = await tx.customer.create({
          data: {
            companyId,
            name,
            phone: ctx.phone ?? null,
            whatsapp: ctx.phone ?? null,
            origin: "WHATSAPP"
          }
        });
        customerId = customer.id;
      }

      const service = await tx.service.findFirst({ where: { id: ctx.serviceId!, companyId } });

      return tx.appointment.create({
        data: {
          companyId,
          customerId,
          serviceId: ctx.serviceId!,
          professionalId: ctx.professionalId!,
          startAt,
          endAt,
          status: AppointmentStatus.SCHEDULED,
          source: AppointmentSource.BOT,
          bookedByClient: true,
          paymentStatus: "PENDING",
          ...(service
            ? {
                appointmentServices: {
                  create: {
                    companyId,
                    serviceId: service.id,
                    serviceNameSnapshot: service.name,
                    unitPrice: service.basePrice,
                    totalPrice: service.basePrice
                  }
                }
              }
            : {})
        }
      });
    });

    await clearState(companyId, phoneKey);
    console.log(`${LOG_PREFIX} agendamento criado company=${companyId} appointment=${appointment.id}`);

    return (
      "✅ Agendamento confirmado!\n" +
      `Serviço: ${ctx.serviceName}\n` +
      `Profissional: ${ctx.professionalName}\n` +
      `Data: ${formatDate(startAt)} às ${formatTime(startAt)}\n\n` +
      "Se precisar remarcar, é só chamar. 😊"
    );
  } catch (error) {
    // Horário tomado nesse meio tempo: re-oferece horários da mesma data.
    if (error instanceof ApiError && error.status === 409) {
      console.warn(`${LOG_PREFIX} conflito ao criar company=${companyId} date=${ctx.date}`);
      return presentSlots(companyId, phoneKey, ctx, ctx.date!);
    }
    const detail = error instanceof Error ? error.message : "erro desconhecido";
    console.error(`${LOG_PREFIX} falha ao criar company=${companyId}: ${detail}`);
    await clearState(companyId, phoneKey);
    return "Ops, não consegui concluir o agendamento agora. 😞 Tente novamente em instantes ou fale com a nossa equipe.";
  }
}

// ─── API pública do serviço ─────────────────────────

/** True se há um fluxo de agendamento em andamento para este JID. */
export async function hasActiveBooking(companyId: string, remoteJid: string): Promise<boolean> {
  const phone = conversationPhone(remoteJid);
  const state = await prisma.botConversationState.findUnique({
    where: { companyId_phone: { companyId, phone } },
    select: { step: true }
  });
  return !!state && state.step !== BotConversationStep.IDLE;
}

/**
 * Processa a mensagem dentro do fluxo de agendamento.
 * Retorna a resposta a enviar, ou null se a mensagem não é de agendamento
 * (sem fluxo ativo e sem palavra-chave) — aí o webhook segue para FAQ/fallback.
 */
export async function handleBookingMessage(input: {
  companyId: string;
  remoteJid: string;
  text: string;
}): Promise<string | null> {
  const { companyId, remoteJid } = input;
  const text = input.text.trim();
  const phoneKey = conversationPhone(remoteJid);
  const normalized = normalizePhone(remoteJid);

  const state = await prisma.botConversationState.findUnique({
    where: { companyId_phone: { companyId, phone: phoneKey } }
  });
  const active = !!state && state.step !== BotConversationStep.IDLE;
  const trigger = isBookingTrigger(text);

  if (!active && !trigger) return null;

  // allowBooking desligado: não cria e orienta a falar com a equipe.
  const config = await prisma.companyBotConfig.findUnique({
    where: { companyId },
    select: { allowBooking: true }
  });
  if (!config?.allowBooking) {
    if (state) await clearState(companyId, phoneKey);
    return "O agendamento pelo WhatsApp está desativado no momento. 🙏\nPor favor, fale com a nossa equipe para marcar o seu horário.";
  }

  if (active && isCancelWord(text)) {
    await clearState(companyId, phoneKey);
    return "Tudo bem, cancelei o agendamento em andamento. 👍\nQuando quiser, é só dizer *agendar* para recomeçar.";
  }

  if (!active) {
    return startBooking(companyId, phoneKey);
  }

  const ctx = (state!.context as unknown as BookingContext) ?? {};

  switch (state!.step) {
    case BotConversationStep.AWAITING_SERVICE:
      return handleServiceChoice(companyId, phoneKey, text, ctx);
    case BotConversationStep.AWAITING_DATE:
      return handleDateChoice(companyId, phoneKey, text, ctx);
    case BotConversationStep.AWAITING_SLOT:
      return handleSlotChoice(companyId, phoneKey, text, ctx, normalized.trusted && normalized.valid, normalized.digits);
    case BotConversationStep.AWAITING_NAME:
      return handleNameOrPhone(companyId, phoneKey, text, ctx);
    default:
      await clearState(companyId, phoneKey);
      return startBooking(companyId, phoneKey);
  }
}
