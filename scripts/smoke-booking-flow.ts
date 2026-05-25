/**
 * Smoke test do FLUXO DE AGENDAMENTO ponta a ponta (bot in-process / Evolution).
 *
 * Percorre a conversa real de agendamento contra a Oficina Central (Max),
 * enviando as mensagens em sequência no formato real da Evolution (messages.upsert)
 * e lendo o estado do banco (via Prisma) entre os passos para:
 *   - escolher um serviço/horário REAIS ofertados pelo bot (nunca inventados);
 *   - verificar as transições de step (AWAITING_SERVICE → ... → limpo);
 *   - confirmar a criação do Appointment (source=BOT, status=SCHEDULED).
 *
 * NÃO envia WhatsApp real: a resposta do bot sai via sendTextMessage para o que
 * estiver em EVOLUTION_API_URL (use scripts/mock-evolution.mjs). Mesmo sem o mock,
 * o agendamento é criado no banco (o envio apenas falha e é logado).
 *
 * Idempotente: limpa o cliente de teste, seus agendamentos e o BotConversationState
 * antes de cada execução.
 *
 * Uso:
 *   npx tsx scripts/smoke-booking-flow.ts [positive|negative|all]
 *
 * Config (env ou .env — sem segredos versionados):
 *   SMOKE_BASE_URL          (default http://localhost:3000)
 *   WHATSAPP_WEBHOOK_TOKEN  (obrigatório; mesmo valor do servidor)
 *   SMOKE_COMPANY_SLUG      (default "oficina-central")
 *   SMOKE_COMPANY_ID        (opcional; tem prioridade sobre o slug)
 *   SMOKE_POS_PHONE         (default 5511970000001 — sem agendamento, fluxo limpo)
 *   SMOKE_NEG_PHONE         (default 5511970000002)
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "../src/lib/prisma";

// ─── env ────────────────────────────────────────────
function loadEnvFile(): Record<string, string> {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env"), "utf8");
    const out: Record<string, string> = {};
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
    return out;
  } catch {
    return {};
  }
}
const fileEnv = loadEnvFile();
const cfg = (name: string, fallback = "") => process.env[name] ?? fileEnv[name] ?? fallback;

const BASE = cfg("SMOKE_BASE_URL", "http://localhost:3000");
const TOKEN = cfg("WHATSAPP_WEBHOOK_TOKEN");
const COMPANY_SLUG = cfg("SMOKE_COMPANY_SLUG", "oficina-central");
const COMPANY_ID_OVERRIDE = cfg("SMOKE_COMPANY_ID");
const POS_PHONE = cfg("SMOKE_POS_PHONE", "5511970000001");
const NEG_PHONE = cfg("SMOKE_NEG_PHONE", "5511970000002");

// ─── tipos do context persistido ────────────────────
type ServiceOption = { id: string; name: string };
type SlotOption = { time: string; startAt: string; endAt: string; professionalId: string; professionalName: string };
type Ctx = {
  serviceOptions?: ServiceOption[];
  slotOptions?: SlotOption[];
  serviceId?: string;
  serviceName?: string;
  date?: string;
  stage?: string;
  phone?: string;
};

// ─── util ───────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pad = (n: number) => String(n).padStart(2, "0");
const digitsOf = (s: string) => s.replace(/\D/g, "");

let failures = 0;
function check(label: string, ok: boolean, extra = "") {
  console.log(`   ${ok ? "✅" : "❌"} ${label}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures += 1;
}
function info(msg: string) {
  console.log(`   ℹ️  ${msg}`);
}
function step(title: string) {
  console.log("\n" + "─".repeat(70));
  console.log(`▶️  ${title}`);
}

type Resolved = { companyId: string; instance: string };

async function preflight(): Promise<Resolved> {
  if (!TOKEN) {
    console.error("\n❌ Falta WHATSAPP_WEBHOOK_TOKEN (env ou .env). Deve ser o mesmo do servidor.\n");
    process.exit(1);
  }
  const company = COMPANY_ID_OVERRIDE
    ? await prisma.company.findUnique({
        where: { id: COMPANY_ID_OVERRIDE },
        select: { id: true, botEnabled: true, botConfiguration: { select: { whatsappInstance: true } } }
      })
    : await prisma.company.findUnique({
        where: { slug: COMPANY_SLUG },
        select: { id: true, botEnabled: true, botConfiguration: { select: { whatsappInstance: true } } }
      });

  if (!company) {
    console.error(`\n❌ Empresa não encontrada (${COMPANY_ID_OVERRIDE || COMPANY_SLUG}). Rodou o seed?\n`);
    process.exit(1);
  }
  if (!company.botEnabled) {
    console.error("\n❌ Bot desligado para a empresa. Ative em /configuracoes/bot (botEnabled).\n");
    process.exit(1);
  }
  const instance = company.botConfiguration?.whatsappInstance;
  if (!instance) {
    console.error("\n❌ whatsappInstance não configurada. Defina-a em /configuracoes/bot.\n");
    process.exit(1);
  }
  return { companyId: company.id, instance };
}

function upsert(text: string, phone: string, instance: string) {
  return {
    event: "messages.upsert",
    instance,
    apikey: "instance-apikey-ignorada",
    data: {
      key: { remoteJid: `${phone}@s.whatsapp.net`, fromMe: false, id: `SMOKE_${Date.now()}` },
      pushName: "Smoke Flow",
      message: { conversation: text },
      instanceId: "smoke-instance-uuid"
    }
  };
}

async function sendMessage(companyId: string, text: string, phone: string, instance: string) {
  const res = await fetch(`${BASE}/api/webhooks/whatsapp/${companyId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-webhook-token": TOKEN },
    body: JSON.stringify(upsert(text, phone, instance))
  });
  const body = await res.text();
  console.log(`   📤 "${text}" → HTTP ${res.status} ${body}`);
  return { status: res.status, body };
}

async function readState(companyId: string, phone: string) {
  const state = await prisma.botConversationState.findUnique({
    where: { companyId_phone: { companyId, phone: digitsOf(phone) } }
  });
  const ctx = (state?.context ?? {}) as unknown as Ctx;
  return { step: state?.step ?? null, ctx, exists: !!state };
}

async function cleanup(companyId: string, phone: string) {
  const last8 = digitsOf(phone).slice(-8);
  const customers = await prisma.customer.findMany({
    where: { companyId, OR: [{ phone: { contains: last8 } }, { whatsapp: { contains: last8 } }] },
    select: { id: true }
  });
  const ids = customers.map((c) => c.id);
  if (ids.length) {
    // Appointment->AppointmentService/SentReminder caem por cascade.
    await prisma.appointment.deleteMany({ where: { companyId, customerId: { in: ids } } });
    await prisma.customer.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.botConversationState.deleteMany({ where: { companyId, phone: digitsOf(phone) } });
}

async function findBotAppointment(companyId: string, phone: string) {
  const last8 = digitsOf(phone).slice(-8);
  return prisma.appointment.findFirst({
    where: {
      companyId,
      source: "BOT",
      customer: { OR: [{ phone: { contains: last8 } }, { whatsapp: { contains: last8 } }] }
    },
    orderBy: { createdAt: "desc" },
    include: { customer: { select: { name: true, phone: true } } }
  });
}

// ─── fluxo POSITIVO ─────────────────────────────────
async function runPositive({ companyId, instance }: Resolved) {
  console.log("\n" + "=".repeat(70));
  console.log("CENÁRIO POSITIVO — agendamento ponta a ponta (allowBooking = true)");
  console.log("=".repeat(70));

  await cleanup(companyId, POS_PHONE);
  info(`Telefone de teste (limpo): ${POS_PHONE}`);

  // 1) inicia
  step('1) Cliente: "quero agendar" → espera lista de serviços (AWAITING_SERVICE)');
  await sendMessage(companyId, "quero agendar", POS_PHONE, instance);
  await sleep(300);
  let s = await readState(companyId, POS_PHONE);
  check("step = AWAITING_SERVICE", s.step === "AWAITING_SERVICE", `step=${s.step}`);
  check("bot ofertou serviços (serviceOptions)", (s.ctx.serviceOptions?.length ?? 0) > 0);
  const services = s.ctx.serviceOptions ?? [];
  if (services.length === 0) {
    console.error("   ⛔ Sem serviços ativos na empresa — não dá para continuar.");
    return;
  }
  const chosenServiceIndex = 1; // primeiro serviço real ofertado
  const chosenService = services[chosenServiceIndex - 1];
  info(`Serviços ofertados: ${services.map((x, i) => `${i + 1}) ${x.name}`).join("  ")}`);
  info(`Escolhendo: ${chosenServiceIndex}) ${chosenService.name}`);

  // 2) escolhe serviço
  step("2) Cliente escolhe o serviço → espera pergunta de data (AWAITING_DATE)");
  await sendMessage(companyId, String(chosenServiceIndex), POS_PHONE, instance);
  await sleep(300);
  s = await readState(companyId, POS_PHONE);
  check("step = AWAITING_DATE", s.step === "AWAITING_DATE", `step=${s.step}`);
  check("serviceId gravado no context", s.ctx.serviceId === chosenService.id);

  // 3) informa data — tenta dias úteis até obter horários reais
  step("3) Cliente informa a data → espera horários DISPONÍVEIS do sistema (AWAITING_SLOT)");
  let slots: SlotOption[] = [];
  let usedDate = "";
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  for (let attempt = 0; attempt < 10 && slots.length === 0; attempt++) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() === 0) continue; // pula domingo
    const ddmm = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
    await sendMessage(companyId, ddmm, POS_PHONE, instance);
    await sleep(300);
    s = await readState(companyId, POS_PHONE);
    if (s.step === "AWAITING_SLOT" && (s.ctx.slotOptions?.length ?? 0) > 0) {
      slots = s.ctx.slotOptions!;
      usedDate = ddmm;
    } else {
      info(`Sem horários em ${ddmm} (step=${s.step}); tentando próxima data...`);
    }
  }
  check("step = AWAITING_SLOT", s.step === "AWAITING_SLOT", `step=${s.step}`);
  check("bot ofertou horários reais (slotOptions)", slots.length > 0, `data=${usedDate}`);
  if (slots.length === 0) {
    console.error("   ⛔ Nenhum horário disponível nos próximos dias — não dá para continuar.");
    return;
  }
  info(`Horários ofertados em ${usedDate}: ${slots.map((x, i) => `${i + 1}) ${x.time} ${x.professionalName}`).join("  ")}`);
  const chosenSlot = slots[0];
  info(`Escolhendo: 1) ${chosenSlot.time} com ${chosenSlot.professionalName} (startAt=${chosenSlot.startAt})`);
  const offeredStartAts = new Set(slots.map((x) => x.startAt));

  // 4) escolhe horário
  step("4) Cliente escolhe o horário → espera pergunta de nome (AWAITING_NAME)");
  await sendMessage(companyId, "1", POS_PHONE, instance);
  await sleep(300);
  s = await readState(companyId, POS_PHONE);
  check("step = AWAITING_NAME (cliente novo)", s.step === "AWAITING_NAME", `step=${s.step}`);

  // 5) informa nome
  step("5) Cliente informa o nome → espera criação do Appointment + estado limpo");
  await sendMessage(companyId, "Cliente Smoke Teste", POS_PHONE, instance);
  await sleep(400);

  const finalState = await readState(companyId, POS_PHONE);
  check("BotConversationState limpo (IDLE/removido)", !finalState.exists || finalState.step === "IDLE", `exists=${finalState.exists} step=${finalState.step}`);

  const appt = await findBotAppointment(companyId, POS_PHONE);
  check("Appointment criado", !!appt, appt ? `id=${appt.id}` : "nenhum");
  if (appt) {
    check("source = BOT", appt.source === "BOT", `source=${appt.source}`);
    check("status = SCHEDULED", appt.status === "SCHEDULED", `status=${appt.status}`);
    check("serviceId = serviço escolhido", appt.serviceId === chosenService.id);
    check("professionalId = profissional do horário", appt.professionalId === chosenSlot.professionalId);
    check(
      "horário é UM DOS ofertados (não inventado)",
      offeredStartAts.has(appt.startAt.toISOString()),
      `startAt=${appt.startAt.toISOString()}`
    );
    check(
      "horário == o que o cliente escolheu",
      appt.startAt.toISOString() === chosenSlot.startAt,
      `esperado=${chosenSlot.startAt}`
    );
    info(`Cliente criado: ${appt.customer?.name} (${appt.customer?.phone})`);
  }
  info("💬 A confirmação ('✅ Agendamento confirmado! ...') saiu via sendTextMessage — veja o mock/captura.");
}

// ─── sub-cenário NEGATIVO ───────────────────────────
async function runNegative({ companyId, instance }: Resolved) {
  console.log("\n" + "=".repeat(70));
  console.log("CENÁRIO NEGATIVO — allowBooking = false (deve recusar, sem criar nada)");
  console.log("=".repeat(70));

  const config = await prisma.companyBotConfig.findUnique({ where: { companyId }, select: { allowBooking: true } });
  if (!config) {
    console.error("   ⛔ CompanyBotConfig não existe — configure o bot primeiro. Pulando negativo.");
    return;
  }

  await cleanup(companyId, NEG_PHONE);
  const original = config.allowBooking;
  await prisma.companyBotConfig.update({ where: { companyId }, data: { allowBooking: false } });
  info(`allowBooking temporariamente = false (original era ${original}; será restaurado).`);

  try {
    step('Cliente: "quero agendar" com allowBooking = false');
    await sendMessage(companyId, "quero agendar", NEG_PHONE, instance);
    await sleep(300);

    const s = await readState(companyId, NEG_PHONE);
    check("NÃO avançou o fluxo (sem BotConversationState ativo)", !s.exists || s.step === "IDLE", `exists=${s.exists} step=${s.step}`);

    const appt = await findBotAppointment(companyId, NEG_PHONE);
    check("NÃO criou Appointment", !appt);
    info("💬 Esperado do bot (na captura): \"O agendamento pelo WhatsApp está desativado no momento. 🙏 ...\"");
  } finally {
    await prisma.companyBotConfig.update({ where: { companyId }, data: { allowBooking: original } });
    info(`allowBooking restaurado para ${original}.`);
  }
}

// ─── main ───────────────────────────────────────────
async function main() {
  const which = (process.argv[2] ?? "all").toLowerCase();
  const resolved = await preflight();
  console.log(`\nAlvo: ${BASE}/api/webhooks/whatsapp/${resolved.companyId}`);
  console.log(`Empresa: ${COMPANY_ID_OVERRIDE || COMPANY_SLUG} | Instância: ${resolved.instance}`);

  if (which === "positive" || which === "all") await runPositive(resolved);
  if (which === "negative" || which === "all") await runNegative(resolved);

  console.log("\n" + "=".repeat(70));
  if (failures === 0) {
    console.log("✅ Smoke do fluxo de agendamento: TODAS as verificações passaram.");
  } else {
    console.log(`❌ Smoke do fluxo de agendamento: ${failures} verificação(ões) falharam.`);
  }
  console.log("=".repeat(70) + "\n");

  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error("\n❌ Erro inesperado:", err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
