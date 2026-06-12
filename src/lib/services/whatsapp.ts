import { ApiError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";

/**
 * Integração com a Evolution API v2 (auto-hospedada).
 * Funções nomeadas, sem classes — segue o padrão de src/lib/services/.
 *
 * Variáveis de ambiente (nunca expor no frontend):
 * - EVOLUTION_API_URL: base da Evolution API (ex: https://evo.seudominio.com)
 * - EVOLUTION_API_KEY: apikey global da Evolution API
 * - WHATSAPP_WEBHOOK_TOKEN: token que valida os webhooks recebidos da Evolution
 */

const REQUEST_TIMEOUT_MS = 8_000;

function evolutionConfig() {
  const url = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;

  if (!url || !apiKey) {
    throw new ApiError(500, "Evolution API não configurada (defina EVOLUTION_API_URL e EVOLUTION_API_KEY).");
  }

  return { url: url.replace(/\/+$/, ""), apiKey };
}

async function getInstance(companyId: string): Promise<string> {
  const config = await prisma.companyBotConfig.findUnique({
    where: { companyId },
    select: { whatsappInstance: true }
  });

  if (!config?.whatsappInstance) {
    throw new ApiError(400, "Instância do WhatsApp não configurada para esta empresa.");
  }

  return config.whatsappInstance;
}

async function evolutionFetch(
  path: string,
  options: { method?: string; apiKey: string; baseUrl: string; body?: unknown }
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(`${options.baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        apikey: options.apiKey
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError(504, "Tempo esgotado ao conectar com a Evolution API.");
    }
    throw new ApiError(502, "Erro ao conectar com a Evolution API.");
  } finally {
    clearTimeout(timeout);
  }
}

export type NormalizedPhone = {
  /** Apenas dígitos, com DDI (ex: "5511977778888"). null se inválido. */
  digits: string | null;
  /** Formato E.164 (ex: "+5511977778888"). null se inválido. */
  e164: string | null;
  valid: boolean;
  /**
   * false quando o remoteJid é "@lid" (mensagem vinda de anúncio): o número
   * exibido pode não ser o telefone real do contato — não usar para identificar
   * ou criar cliente sem confirmação.
   */
  trusted: boolean;
};

/**
 * Normaliza um remoteJid do WhatsApp para E.164 brasileiro.
 *
 * "5511977778888@s.whatsapp.net" -> { e164: "+5511977778888", trusted: true }
 * "5511977778888@lid"            -> trusted: false (número possivelmente não real)
 * Aceita também número cru ("11977778888", "+55 11 97777-8888").
 *
 * Valida DDI (55) e DDD brasileiro (11–99). Aceita celular (9 dígitos) e
 * fixo (8 dígitos).
 */
export function normalizePhone(phone: string): NormalizedPhone {
  const invalid = (trusted: boolean): NormalizedPhone => ({ digits: null, e164: null, valid: false, trusted });

  if (!phone) return invalid(true);

  const atIndex = phone.indexOf("@");
  const domain = atIndex >= 0 ? phone.slice(atIndex + 1).toLowerCase() : "";
  const local = atIndex >= 0 ? phone.slice(0, atIndex) : phone;

  // "@lid" = identificador de anúncio: o número pode não ser confiável.
  const trusted = domain !== "lid";

  let digits = local.replace(/\D/g, "");
  if (!digits) return invalid(trusted);

  // Sem DDI: assume Brasil quando vier só DDD + número (10 ou 11 dígitos).
  if (!digits.startsWith("55") && (digits.length === 10 || digits.length === 11)) {
    digits = `55${digits}`;
  }

  // Esperado: 55 + DDD(2) + assinante(8 fixo | 9 celular) = 12 ou 13 dígitos.
  if (!digits.startsWith("55") || (digits.length !== 12 && digits.length !== 13)) {
    return invalid(trusted);
  }

  const ddd = Number(digits.slice(2, 4));
  if (ddd < 11 || ddd > 99) {
    return invalid(trusted);
  }

  const subscriber = digits.slice(4);
  // Celular brasileiro tem 9 dígitos e começa com 9; fixo tem 8.
  if (subscriber.length === 9 && !subscriber.startsWith("9")) {
    return invalid(trusted);
  }

  return { digits, e164: `+${digits}`, valid: true, trusted };
}

/**
 * Envia uma mensagem de texto via Evolution API v2.
 * POST {EVOLUTION_API_URL}/message/sendText/{instance} com header "apikey".
 */
export async function sendTextMessage(companyId: string, phone: string, message: string) {
  const { url, apiKey } = evolutionConfig();
  const instance = await getInstance(companyId);

  const normalized = normalizePhone(phone);
  const number = normalized.digits ?? phone.replace(/\D/g, "");
  if (!number) {
    throw new ApiError(422, "Número de telefone inválido.");
  }

  const response = await evolutionFetch(`/message/sendText/${encodeURIComponent(instance)}`, {
    method: "POST",
    baseUrl: url,
    apiKey,
    body: { number, text: message }
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new ApiError(502, `Falha ao enviar mensagem pela Evolution API (HTTP ${response.status}).`, detail.slice(0, 500));
  }

  return response.json().catch(() => ({}));
}

export type ConnectionState = {
  instance: string;
  state: string;
  connected: boolean;
};

/**
 * Consulta o connectionState da instância na Evolution API.
 * GET {EVOLUTION_API_URL}/instance/connectionState/{instance}.
 */
export async function testConnection(companyId: string): Promise<ConnectionState> {
  const { url, apiKey } = evolutionConfig();
  const instance = await getInstance(companyId);

  const response = await evolutionFetch(`/instance/connectionState/${encodeURIComponent(instance)}`, {
    baseUrl: url,
    apiKey
  });

  if (!response.ok) {
    throw new ApiError(502, `Não foi possível consultar a instância "${instance}" (HTTP ${response.status}).`);
  }

  const data = (await response.json().catch(() => ({}))) as {
    instance?: { state?: string };
    state?: string;
  };
  const state = data.instance?.state ?? data.state ?? "unknown";

  return { instance, state, connected: state === "open" };
}

/**
 * Retorna true se a instância da empresa existe e está conectada na Evolution.
 */
export async function validateInstance(companyId: string): Promise<boolean> {
  const { connected } = await testConnection(companyId);
  return connected;
}

/** Lê o nome da instância sem lançar (null quando ainda não configurada). */
async function findInstance(companyId: string): Promise<string | null> {
  const config = await prisma.companyBotConfig.findUnique({
    where: { companyId },
    select: { whatsappInstance: true }
  });
  return config?.whatsappInstance ?? null;
}

/**
 * Recria a instância na Evolution API e configura o webhook que entrega o QR Code.
 *
 * Na Evolution v2.2.3 o GET /instance/connect retorna {"count":0} (bug conhecido):
 * o QR só chega pelo evento webhook QRCODE_UPDATED. Por isso aqui:
 *  1) apagamos a instância antiga (estado sujo não emite QR novo),
 *  2) aguardamos a liberação do nome,
 *  3) criamos já apontando o webhook para /api/webhooks/whatsapp/{companyId},
 *  4) marcamos connectionStatus="connecting" — o QR chega em ~2-5s via webhook.
 *
 * O webhook é configurado com byEvents=false (todos os eventos na mesma URL,
 * distinguidos pelo campo `event` do corpo) e o header x-webhook-token, casando
 * com a validação em src/app/api/webhooks/whatsapp/[companyId]/route.ts.
 */
export async function createInstance(companyId: string): Promise<{ instance: string }> {
  const { url, apiKey } = evolutionConfig();
  const instanceName = `company-${companyId}`;

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://marcaiflex.com.br").replace(/\/+$/, "");
  const webhookUrl = `${appUrl}/api/webhooks/whatsapp/${companyId}`;
  const webhookToken = process.env.WHATSAPP_WEBHOOK_TOKEN ?? "";

  // Apaga a instância existente (se houver) para recriar limpa — ignora erro se
  // ela não existir.
  await evolutionFetch(`/instance/delete/${encodeURIComponent(instanceName)}`, {
    method: "DELETE",
    baseUrl: url,
    apiKey
  }).catch(() => undefined);

  // Aguarda a Evolution liberar o nome antes de recriar.
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const response = await evolutionFetch("/instance/create", {
    method: "POST",
    baseUrl: url,
    apiKey,
    body: {
      instanceName,
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
      webhook: {
        enabled: true,
        url: webhookUrl,
        byEvents: false,
        base64: true,
        headers: { "x-webhook-token": webhookToken },
        events: ["QRCODE_UPDATED", "CONNECTION_UPDATE", "MESSAGES_UPSERT"]
      }
    }
  });

  // 403/409 = instância já existe na Evolution; seguimos para persistir o nome.
  if (!response.ok && response.status !== 403 && response.status !== 409) {
    const detail = await response.text().catch(() => "");
    throw new ApiError(
      502,
      `Falha ao criar a instância na Evolution API (HTTP ${response.status}).`,
      detail.slice(0, 500)
    );
  }

  await prisma.companyBotConfig.upsert({
    where: { companyId },
    update: { whatsappInstance: instanceName, connectionStatus: "connecting", qrCodeBase64: null, qrCodeExpiresAt: null },
    create: { companyId, whatsappInstance: instanceName, connectionStatus: "connecting" }
  });

  return { instance: instanceName };
}

export type QrCodeResult = {
  /** data URL (data:image/png;base64,...) do QR Code, ou null. */
  qrcode: string | null;
  status: "qr" | "connected" | "disconnected" | "connecting";
};

/**
 * Retorna o QR Code / estado da conexão lendo do banco (CompanyBotConfig). O QR
 * é gravado pelo webhook QRCODE_UPDATED; aqui só servimos o valor mais recente.
 *
 * - QR válido (não expirado) -> { qrcode, status: "qr" }
 * - QR expirado -> limpa e cai para "connecting" (aguardando novo QR via webhook)
 * - connectionStatus "open" -> "connected"
 * - "disconnected" -> reconcilia com o connectionState real da Evolution (esse
 *   endpoint NÃO tem o bug do /connect), cobrindo instâncias conectadas antes
 *   desta feature (sem webhook de connection registrado).
 */
export async function getQrCode(companyId: string): Promise<QrCodeResult> {
  const config = await prisma.companyBotConfig.findUnique({
    where: { companyId },
    select: { whatsappInstance: true, qrCodeBase64: true, qrCodeExpiresAt: true, connectionStatus: true }
  });

  if (!config) return { qrcode: null, status: "disconnected" };

  const now = new Date();
  const qrExpired = Boolean(config.qrCodeExpiresAt && config.qrCodeExpiresAt <= now);

  // QR ainda válido — serve direto.
  if (config.qrCodeBase64 && !qrExpired) {
    return { qrcode: config.qrCodeBase64, status: "qr" };
  }

  // QR expirado — limpa para não servir um código morto.
  if (config.qrCodeBase64 && qrExpired) {
    await prisma.companyBotConfig.update({
      where: { companyId },
      data: { qrCodeBase64: null, qrCodeExpiresAt: null }
    });
  }

  if (config.connectionStatus === "open") return { qrcode: null, status: "connected" };

  // "connecting" ou "qr" sem base64 válido = aguardando o (próximo) QR do webhook.
  if (config.connectionStatus === "connecting" || config.connectionStatus === "qr") {
    return { qrcode: null, status: "connecting" };
  }

  // "disconnected": confirma com a Evolution se a instância já não está conectada.
  if (config.whatsappInstance) {
    try {
      const { connected } = await testConnection(companyId);
      if (connected) {
        await prisma.companyBotConfig.update({
          where: { companyId },
          data: { connectionStatus: "open", qrCodeBase64: null, qrCodeExpiresAt: null }
        });
        return { qrcode: null, status: "connected" };
      }
    } catch {
      // Evolution indisponível — trata como desconectado.
    }
  }

  return { qrcode: null, status: "disconnected" };
}

/**
 * Desconecta (logout) a instância da empresa.
 * DELETE /instance/logout/{instance}.
 */
export async function disconnectInstance(companyId: string): Promise<void> {
  const instance = await findInstance(companyId);
  if (!instance) return;

  const { url, apiKey } = evolutionConfig();
  await evolutionFetch(`/instance/logout/${encodeURIComponent(instance)}`, {
    method: "DELETE",
    baseUrl: url,
    apiKey
  });
}
