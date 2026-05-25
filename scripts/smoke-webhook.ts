/**
 * Smoke test do webhook do Bot WhatsApp (in-process, Evolution API).
 *
 * Dispara POSTs contra POST /api/webhooks/whatsapp/<companyId> usando o formato
 * REAL de payload da Evolution (messages.upsert), SEM precisar de WhatsApp real.
 *
 * Uso:
 *   npx tsx scripts/smoke-webhook.ts <cenario>
 *
 * Cenários: security | confirm | cancel | nopending | faq | book-start |
 *           book-disabled | fallback | all
 *
 * Config via variáveis de ambiente (NÃO commitar segredos):
 *   SMOKE_BASE_URL        (default http://localhost:3000)
 *   SMOKE_COMPANY_ID      (obrigatório — id da empresa; ver docs/bot-smoke-test.md)
 *   WHATSAPP_WEBHOOK_TOKEN(obrigatório — mesmo valor do .env / header x-webhook-token)
 *   SMOKE_INSTANCE        (obrigatório — deve bater com whatsappInstance configurada)
 *   SMOKE_PHONE           (default 5511988882000 — cliente do seed com agendamento SCHEDULED)
 *   SMOKE_PHONE_NO_APPT   (default 5511900000000 — número sem agendamento)
 *
 * IMPORTANTE: a resposta HTTP do webhook é sempre { received: true } (200) para
 * mensagens processadas. A RESPOSTA do bot (texto) NÃO vem no corpo HTTP — ela é
 * enviada via sendTextMessage para a Evolution. Para vê-la, observe a captura de
 * saída (scripts/mock-evolution.mjs ou webhook.site) e os logs do servidor.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(): Record<string, string> {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env"), "utf8");
    const out: Record<string, string> = {};
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
    return out;
  } catch {
    return {};
  }
}

const fileEnv = loadEnvFile();
const cfg = (name: string, fallback = "") => process.env[name] ?? fileEnv[name] ?? fallback;

const BASE = cfg("SMOKE_BASE_URL", "http://localhost:3000");
const COMPANY_ID = cfg("SMOKE_COMPANY_ID");
const TOKEN = cfg("WHATSAPP_WEBHOOK_TOKEN");
const INSTANCE = cfg("SMOKE_INSTANCE");
const PHONE = cfg("SMOKE_PHONE", "5511988882000");
const PHONE_NO_APPT = cfg("SMOKE_PHONE_NO_APPT", "5511900000000");

const URL = `${BASE}/api/webhooks/whatsapp/${COMPANY_ID}`;

function requireConfig() {
  const missing: string[] = [];
  if (!COMPANY_ID) missing.push("SMOKE_COMPANY_ID");
  if (!TOKEN) missing.push("WHATSAPP_WEBHOOK_TOKEN");
  if (!INSTANCE) missing.push("SMOKE_INSTANCE");
  if (missing.length) {
    console.error(`\n❌ Faltam variáveis de ambiente: ${missing.join(", ")}`);
    console.error("   Veja docs/bot-smoke-test.md (seção 'Rodando o smoke test').\n");
    process.exit(1);
  }
}

/** messages.upsert no formato real da Evolution. */
function upsert(opts: {
  text: string;
  phone?: string;
  instance?: string;
  fromMe?: boolean;
  useExtended?: boolean;
}) {
  const phone = opts.phone ?? PHONE;
  const message = opts.useExtended
    ? { extendedTextMessage: { text: opts.text } }
    : { conversation: opts.text };
  return {
    event: "messages.upsert",
    instance: opts.instance ?? INSTANCE,
    apikey: "instance-apikey-ignorada-pelo-nosso-webhook",
    data: {
      key: { remoteJid: `${phone}@s.whatsapp.net`, fromMe: opts.fromMe ?? false, id: `SMOKE_${Date.now()}` },
      pushName: "Smoke Test",
      message,
      instanceId: "smoke-instance-uuid"
    }
  };
}

async function post(body: unknown, opts: { token?: string | null } = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = opts.token === undefined ? TOKEN : opts.token;
  if (token !== null) headers["x-webhook-token"] = token;

  try {
    const res = await fetch(URL, { method: "POST", headers, body: JSON.stringify(body) });
    const text = await res.text();
    return { status: res.status, body: text };
  } catch (err) {
    console.error(`\n❌ Não consegui falar com ${URL}`);
    console.error("   O servidor está rodando? (npm run dev)\n", err);
    process.exit(1);
  }
}

function header(title: string) {
  console.log("\n" + "─".repeat(70));
  console.log(`🧪 ${title}`);
}

function report(args: {
  enviado: string;
  esperadoHttp: string;
  respostaBot?: string;
  resultado: { status: number; body: string };
}) {
  console.log(`   ➡️  enviado:        ${args.enviado}`);
  console.log(`   ✅ esperado (HTTP): ${args.esperadoHttp}`);
  if (args.respostaBot) {
    console.log(`   💬 resposta do bot (ver captura de saída/logs): "${args.respostaBot}"`);
  }
  console.log(`   📥 resultado:       HTTP ${args.resultado.status} ${args.resultado.body}`);
}

// ─── Cenários ───────────────────────────────────────

async function scConfirm() {
  header('(a) "1" confirma um agendamento SCHEDULED existente');
  const r = await post(upsert({ text: "1", phone: PHONE }));
  report({
    enviado: `"1" de ${PHONE} (cliente com agendamento SCHEDULED futuro)`,
    esperadoHttp: '200 {"received":true}',
    respostaBot: "✅ Agendamento confirmado! Te esperamos em <data> às <hora>.",
    resultado: r
  });
  console.log("   🔎 Confirme no banco: o agendamento passou de SCHEDULED → CONFIRMED.");
  console.log("   ⚠️  Isso CONSOME o agendamento do seed. Rode `npm run db:seed` antes de testar (b).");
}

async function scCancel() {
  header('(b) "2" cancela um agendamento SCHEDULED existente');
  const r = await post(upsert({ text: "2", phone: PHONE }));
  report({
    enviado: `"2" de ${PHONE} (cliente com agendamento SCHEDULED futuro)`,
    esperadoHttp: '200 {"received":true}',
    respostaBot: "Agendamento cancelado. Para reagendar, é só chamar por aqui.",
    resultado: r
  });
  console.log("   🔎 Confirme no banco: o agendamento passou de SCHEDULED → CANCELLED (canceledAt preenchido).");
}

async function scNoPending() {
  header('(c) "1"/"2" sem agendamento pendente');
  const r = await post(upsert({ text: "1", phone: PHONE_NO_APPT }));
  report({
    enviado: `"1" de ${PHONE_NO_APPT} (número sem agendamento)`,
    esperadoHttp: '200 {"received":true}',
    respostaBot: "Não encontrei nenhum agendamento pendente para este número.",
    resultado: r
  });
}

async function scFaq() {
  header("(d) Pergunta de FAQ que casa com o faqConfig configurado");
  const r = await post(upsert({ text: "qual o horário de funcionamento?", phone: PHONE_NO_APPT, useExtended: true }));
  report({
    enviado: '"qual o horário de funcionamento?" (via extendedTextMessage.text)',
    esperadoHttp: '200 {"received":true}',
    respostaBot: "<a resposta que você configurou no FAQ para essa pergunta>",
    resultado: r
  });
  console.log("   ℹ️  Requer um FAQ cadastrado em /configuracoes/bot (ex.: pergunta 'Qual o horário de funcionamento?').");
}

async function scBookStart() {
  header("(e) Início do fluxo de agendamento (allowBooking = true)");
  const r = await post(upsert({ text: "agendar", phone: PHONE_NO_APPT }));
  report({
    enviado: '"agendar" de um número novo',
    esperadoHttp: '200 {"received":true}',
    respostaBot: "Vamos agendar! 📅 Escolha o serviço respondendo com o número: 1) ... 2) ...",
    resultado: r
  });
  console.log("   🔎 Confirme no banco: criou um BotConversationState (step AWAITING_SERVICE) para esse número.");
  console.log("   ▶️  Para continuar o fluxo, responda com o número do serviço/data/horário lendo os prompts na captura de saída.");
}

async function scBookDisabled() {
  header("(f) Tentativa de agendamento com allowBooking = false (recusa amigável)");
  const r = await post(upsert({ text: "agendar", phone: PHONE_NO_APPT }));
  report({
    enviado: '"agendar" com allowBooking desligado em /configuracoes/bot',
    esperadoHttp: '200 {"received":true}',
    respostaBot: "O agendamento pelo WhatsApp está desativado no momento. 🙏 Por favor, fale com a nossa equipe...",
    resultado: r
  });
  console.log("   ℹ️  Desligue 'Permitir que o bot crie agendamentos' em /configuracoes/bot antes deste teste.");
}

async function scFallback() {
  header("(bônus) Mensagem que não casa com nada → fallback amigável");
  const r = await post(upsert({ text: "asdkjhasd", phone: PHONE_NO_APPT }));
  report({
    enviado: '"asdkjhasd" (sem FAQ, sem comando, sem agendamento)',
    esperadoHttp: '200 {"received":true}',
    respostaBot: "Olá! 👋 Sou o assistente virtual. Posso te ajudar com... (mensagem de fallback)",
    resultado: r
  });
}

async function scSecurity() {
  header("(g) Casos NEGATIVOS de segurança");

  console.log("\n   g1) Sem header de token");
  let r = await post(upsert({ text: "oi" }), { token: null });
  report({
    enviado: "messages.upsert sem header x-webhook-token",
    esperadoHttp: '401 {"error":"Webhook não autorizado."}',
    resultado: r
  });

  console.log("\n   g2) Token inválido");
  r = await post(upsert({ text: "oi" }), { token: "token-errado" });
  report({
    enviado: "messages.upsert com x-webhook-token incorreto",
    esperadoHttp: '401 {"error":"Webhook não autorizado."}',
    resultado: r
  });

  console.log("\n   g3) Instância que não bate com a configurada");
  r = await post(upsert({ text: "oi", instance: "instancia-que-nao-existe" }));
  report({
    enviado: 'instance="instancia-que-nao-existe" (≠ whatsappInstance configurada)',
    esperadoHttp: '403 {"error":"Empresa ou instância não autorizada."}',
    resultado: r
  });

  console.log("\n   g4) fromMe = true (mensagem do próprio bot → ignorar, sem loop)");
  r = await post(upsert({ text: "oi", fromMe: true }));
  report({
    enviado: "messages.upsert com data.key.fromMe = true",
    esperadoHttp: '200 {"received":true,"ignored":true} — e NENHUM envio de saída',
    resultado: r
  });
}

const scenarios: Record<string, () => Promise<void>> = {
  confirm: scConfirm,
  cancel: scCancel,
  nopending: scNoPending,
  faq: scFaq,
  "book-start": scBookStart,
  "book-disabled": scBookDisabled,
  fallback: scFallback,
  security: scSecurity
};

async function main() {
  requireConfig();
  const which = (process.argv[2] ?? "all").toLowerCase();

  console.log(`\nAlvo: ${URL}`);
  console.log(`Instância: ${INSTANCE} | Telefone c/ agendamento: ${PHONE} | Telefone s/ agendamento: ${PHONE_NO_APPT}`);

  if (which === "all") {
    // Conjunto que NÃO consome o agendamento do seed nem exige toggles específicos.
    await scSecurity();
    await scNoPending();
    await scFaq();
    await scFallback();
    await scBookStart();
    console.log("\n" + "─".repeat(70));
    console.log("ℹ️  Rode separadamente (precisam de estado/toggle específicos):");
    console.log("    npx tsx scripts/smoke-webhook.ts confirm        # (a) consome o agendamento do seed");
    console.log("    npm run db:seed && npx tsx scripts/smoke-webhook.ts cancel   # (b)");
    console.log("    npx tsx scripts/smoke-webhook.ts book-disabled  # (f) com allowBooking OFF");
    console.log("─".repeat(70) + "\n");
    return;
  }

  const fn = scenarios[which];
  if (!fn) {
    console.error(`\nCenário desconhecido: "${which}".`);
    console.error(`Use: ${Object.keys(scenarios).join(" | ")} | all\n`);
    process.exit(1);
  }
  await fn();
  console.log("");
}

main();
