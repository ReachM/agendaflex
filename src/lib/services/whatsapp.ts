import { ApiError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";

/**
 * Integração com a WuzAPI (auto-hospedada, baseada em whatsmeow).
 * Funções nomeadas, sem classes — segue o padrão de src/lib/services/.
 *
 * Diferença chave em relação à Evolution API: o QR Code é retornado
 * DIRETAMENTE por GET /session/qr (sem webhook, sem delay). O webhook por
 * empresa serve apenas para receber mensagens recebidas (evento "Message").
 *
 * Variáveis de ambiente (nunca expor no frontend):
 * - WUZAPI_URL: base da WuzAPI (ex: http://localhost:8080)
 * - WUZAPI_ADMIN_TOKEN: token admin global da WuzAPI (header Authorization)
 * - WHATSAPP_WEBHOOK_TOKEN: opcional — se definido, valida x-webhook-token nos
 *   webhooks recebidos (a WuzAPI não envia esse header por padrão).
 */

const REQUEST_TIMEOUT_MS = 8_000;

function wuzapiConfig() {
  const url = (process.env.WUZAPI_URL ?? "http://localhost:8080").replace(/\/+$/, "");
  const adminToken = process.env.WUZAPI_ADMIN_TOKEN;
  if (!adminToken) throw new ApiError(500, "WUZAPI_ADMIN_TOKEN não configurado.");
  return { url, adminToken };
}

/** Token por empresa usado no header `Token` das rotas de sessão/chat. */
function companyToken(companyId: string) {
  return `wuzapi-${companyId}`;
}

/** Nome do usuário/instância na WuzAPI para a empresa. */
function instanceName(companyId: string) {
  return `company-${companyId}`;
}

async function wuzapiFetch(
  path: string,
  options: {
    method?: string;
    token?: string;
    adminToken?: string;
    baseUrl: string;
    body?: unknown;
  }
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (options.token) headers["Token"] = options.token;
    if (options.adminToken) headers["Authorization"] = options.adminToken;
    return await fetch(`${options.baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw new ApiError(504, "Timeout ao conectar com WuzAPI.");
    throw new ApiError(502, "Erro ao conectar com WuzAPI.");
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
 * Envia uma mensagem de texto via WuzAPI.
 * POST {WUZAPI_URL}/chat/send/text com header "Token" da empresa.
 */
export async function sendTextMessage(companyId: string, phone: string, message: string) {
  const { url } = wuzapiConfig();
  const token = companyToken(companyId);

  const normalized = normalizePhone(phone);
  const number = normalized.digits ?? phone.replace(/\D/g, "");
  if (!number) {
    throw new ApiError(422, "Número de telefone inválido.");
  }

  const response = await wuzapiFetch("/chat/send/text", {
    method: "POST",
    baseUrl: url,
    token,
    body: { Phone: `${number}@s.whatsapp.net`, Body: message }
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new ApiError(502, `Falha ao enviar mensagem pela WuzAPI (HTTP ${response.status}).`, detail.slice(0, 500));
  }

  return response.json().catch(() => ({}));
}

export type ConnectionState = {
  instance: string;
  state: string;
  connected: boolean;
};

/**
 * Consulta o estado da sessão da empresa na WuzAPI.
 * GET {WUZAPI_URL}/session/status -> { data: { connected: boolean } }.
 */
export async function testConnection(companyId: string): Promise<ConnectionState> {
  const { url } = wuzapiConfig();
  const token = companyToken(companyId);
  const instance = instanceName(companyId);

  const response = await wuzapiFetch("/session/status", { baseUrl: url, token });

  if (!response.ok) {
    throw new ApiError(502, `Não foi possível consultar a sessão "${instance}" (HTTP ${response.status}).`);
  }

  const data = (await response.json().catch(() => ({}))) as { data?: { connected?: boolean } };
  const connected = data.data?.connected === true;

  return { instance, state: connected ? "open" : "close", connected };
}

/**
 * Retorna true se a sessão da empresa existe e está conectada na WuzAPI.
 */
export async function validateInstance(companyId: string): Promise<boolean> {
  const { connected } = await testConnection(companyId);
  return connected;
}

/**
 * (Re)cria o usuário/sessão da empresa na WuzAPI e inicia a conexão.
 *
 * Fluxo:
 *  1) lista usuários (admin),
 *  2) remove o usuário antigo com o mesmo name (estado sujo não emite QR novo),
 *  3) aguarda a liberação do token/name,
 *  4) cria o usuário com webhook por empresa (evento "Message"),
 *  5) inicia a sessão (POST /session/connect) — o QR fica disponível em ~1-2s
 *     via GET /session/qr,
 *  6) marca connectionStatus="connecting".
 */
export async function createInstance(companyId: string): Promise<{ instance: string }> {
  const { url, adminToken } = wuzapiConfig();
  const name = instanceName(companyId);
  const token = companyToken(companyId);

  // 1) + 2) Remove usuário existente com o mesmo name (ignora erro se não houver).
  try {
    const listRes = await wuzapiFetch("/admin/users", { baseUrl: url, adminToken });
    if (listRes.ok) {
      const json = (await listRes.json().catch(() => ({}))) as {
        data?: Array<{ id?: string | number; name?: string }>;
      };
      const users = Array.isArray(json.data) ? json.data : [];
      const existing = users.find((u) => u.name === name);
      if (existing?.id !== undefined && existing.id !== null) {
        await wuzapiFetch(`/admin/users/${encodeURIComponent(String(existing.id))}`, {
          method: "DELETE",
          baseUrl: url,
          adminToken
        }).catch(() => undefined);
      }
    }
  } catch {
    // Lista indisponível — segue para tentar criar mesmo assim.
  }

  // 3) Aguarda a WuzAPI liberar o token/name antes de recriar.
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // 4) Cria o usuário com webhook por empresa.
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
  const createRes = await wuzapiFetch("/admin/users", {
    method: "POST",
    baseUrl: url,
    adminToken,
    body: {
      name,
      token,
      webhook: `${appUrl}/api/webhooks/whatsapp/${companyId}`,
      events: "Message"
    }
  });

  if (!createRes.ok) {
    const detail = await createRes.text().catch(() => "");
    throw new ApiError(502, `Falha ao criar usuário na WuzAPI (HTTP ${createRes.status}).`, detail.slice(0, 500));
  }

  // 5) Inicia a sessão (best-effort: pode já estar conectando).
  await wuzapiFetch("/session/connect", {
    method: "POST",
    baseUrl: url,
    token,
    body: { Subscribe: ["Message"], Immediate: true }
  }).catch(() => undefined);

  // 6) Persiste o estado "connecting".
  await prisma.companyBotConfig.upsert({
    where: { companyId },
    update: { whatsappInstance: name, connectionStatus: "connecting", qrCodeBase64: null, qrCodeExpiresAt: null },
    create: {
      companyId,
      whatsappInstance: name,
      connectionStatus: "connecting",
      reminderConfig: { enabled: true, send24h: true, send2h: true }
    }
  });

  return { instance: name };
}

export type QrCodeResult = {
  /** data URL (data:image/png;base64,...) do QR Code, ou null. */
  qrcode: string | null;
  status: "qr" | "connected" | "disconnected" | "connecting";
};

/**
 * Retorna o QR Code / estado da conexão consultando a WuzAPI diretamente.
 *
 * - connectionStatus "open" no banco -> "connected" (sem ida à WuzAPI)
 * - GET /session/qr com QRCode -> grava o base64 (TTL 60s) e retorna "qr"
 * - sem QR -> GET /session/status: connected -> "connected", senão "connecting"
 */
export async function getQrCode(companyId: string): Promise<QrCodeResult> {
  const config = await prisma.companyBotConfig.findUnique({
    where: { companyId },
    select: { connectionStatus: true }
  });

  if (!config) return { qrcode: null, status: "disconnected" };
  if (config.connectionStatus === "open") return { qrcode: null, status: "connected" };

  const { url } = wuzapiConfig();
  const token = companyToken(companyId);

  // 1) Tenta obter o QR diretamente.
  const qrRes = await wuzapiFetch("/session/qr", { baseUrl: url, token }).catch(() => null);
  if (qrRes?.ok) {
    const json = (await qrRes.json().catch(() => ({}))) as { data?: { QRCode?: string } };
    const qrcode = json.data?.QRCode;
    if (qrcode) {
      await prisma.companyBotConfig.update({
        where: { companyId },
        data: {
          qrCodeBase64: qrcode,
          qrCodeExpiresAt: new Date(Date.now() + 60_000),
          connectionStatus: "qr"
        }
      });
      return { qrcode, status: "qr" };
    }
  }

  // 2) Sem QR — verifica se a sessão já está conectada.
  const statusRes = await wuzapiFetch("/session/status", { baseUrl: url, token }).catch(() => null);
  if (statusRes?.ok) {
    const json = (await statusRes.json().catch(() => ({}))) as { data?: { connected?: boolean } };
    if (json.data?.connected === true) {
      await prisma.companyBotConfig.update({
        where: { companyId },
        data: { connectionStatus: "open", qrCodeBase64: null, qrCodeExpiresAt: null }
      });
      return { qrcode: null, status: "connected" };
    }
  }

  return { qrcode: null, status: "connecting" };
}

/**
 * Desconecta (logout) a sessão da empresa na WuzAPI e marca o banco como
 * desconectado. POST /session/logout — ignora erro se a sessão não existir.
 */
export async function disconnectInstance(companyId: string): Promise<void> {
  const { url } = wuzapiConfig();
  const token = companyToken(companyId);

  await wuzapiFetch("/session/logout", { method: "POST", baseUrl: url, token }).catch(() => undefined);

  // A WuzAPI não envia evento de conexão; refletimos o estado no banco aqui para
  // que o painel não mostre "conectado" após um reload.
  await prisma.companyBotConfig.updateMany({
    where: { companyId },
    data: { connectionStatus: "disconnected", qrCodeBase64: null, qrCodeExpiresAt: null }
  });
}
