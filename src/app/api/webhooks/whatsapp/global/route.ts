import { NextRequest } from "next/server";
import { ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";

const LOG_PREFIX = "[Bot WhatsApp Global]";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Webhook GLOBAL da Evolution API (WEBHOOK_GLOBAL_URL no Docker).
 *
 * Recebe TODOS os eventos de TODAS as instâncias numa única URL. Existe porque,
 * na Evolution v2.2.3, o webhook por-instância não dispara QRCODE_UPDATED de
 * forma confiável — o global funciona. A empresa é identificada pelo nome da
 * instância ("company-{companyId}").
 *
 * - qrcode.updated    -> grava o base64 no banco (TTL 60s) p/ o polling do front
 * - connection.update -> atualiza connectionStatus
 * - messages.upsert   -> encaminha p/ o handler por empresa, que valida token,
 *                        instância, botEnabled e plano e processa a conversa
 *
 * Nunca retorna erro para a Evolution (evita retries em loop).
 */
export async function POST(request: NextRequest) {
  try {
    const body = asRecord(await request.json().catch(() => ({})));

    const event = asString(body.event) || asString(body.type);
    const instanceName = asString(body.instance) || asString(body.instanceName);

    // Empresa identificada pelo nome da instância ("company-{companyId}").
    const match = instanceName.match(/^company-(.+)$/);
    if (!match) {
      // Instância que não é de empresa (ex.: marcaiflex-bot) — ignora.
      return ok({ received: true, skipped: true });
    }
    const companyId = match[1];
    const data = asRecord(body.data);

    // ── QRCODE_UPDATED ────────────────────────────────────────────────────────
    if (event === "qrcode.updated" || event === "QRCODE_UPDATED") {
      const qrBase64 =
        asString(asRecord(data.qrcode).base64) ||
        asString(data.base64) ||
        asString(asRecord(body.qrcode).base64);

      if (qrBase64) {
        await prisma.companyBotConfig.updateMany({
          where: { companyId, connectionStatus: { not: "open" } },
          data: {
            qrCodeBase64: qrBase64,
            qrCodeExpiresAt: new Date(Date.now() + 60_000),
            connectionStatus: "qr"
          }
        });
        console.log(`${LOG_PREFIX} QR atualizado company=${companyId}`);
      }
      return ok({ received: true });
    }

    // ── CONNECTION_UPDATE ─────────────────────────────────────────────────────
    if (event === "connection.update" || event === "CONNECTION_UPDATE") {
      const state = asString(data.state) || asString(asRecord(data.instance).state) || asString(body.state);

      if (state === "open") {
        await prisma.companyBotConfig.updateMany({
          where: { companyId },
          data: { connectionStatus: "open", qrCodeBase64: null, qrCodeExpiresAt: null }
        });
        console.log(`${LOG_PREFIX} conectado company=${companyId}`);
      } else if (state === "connecting") {
        await prisma.companyBotConfig.updateMany({
          where: { companyId, connectionStatus: { not: "open" } },
          data: { connectionStatus: "connecting" }
        });
      } else if (state === "close") {
        await prisma.companyBotConfig.updateMany({
          where: { companyId },
          data: { connectionStatus: "disconnected", qrCodeBase64: null, qrCodeExpiresAt: null }
        });
        console.log(`${LOG_PREFIX} desconectado company=${companyId}`);
      }
      return ok({ received: true });
    }

    // ── MESSAGES_UPSERT — encaminha p/ o handler por empresa ───────────────────
    if (event === "messages.upsert" || event === "MESSAGES_UPSERT") {
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://marcaiflex.com.br").replace(/\/+$/, "");
      // fire-and-forget: o handler por empresa faz toda a validação e a resposta.
      void fetch(`${appUrl}/api/webhooks/whatsapp/${companyId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-token": process.env.WHATSAPP_WEBHOOK_TOKEN ?? ""
        },
        body: JSON.stringify(body)
      }).catch(() => undefined);
    }

    return ok({ received: true });
  } catch (error) {
    console.error(`${LOG_PREFIX} erro:`, error);
    return ok({ received: true });
  }
}
