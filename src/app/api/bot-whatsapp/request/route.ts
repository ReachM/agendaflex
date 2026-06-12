import { Prisma, RoleName, UserStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handleApiError, ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { requirePlanFeature } from "@/lib/security/plan-guard";
import { sendEmail } from "@/lib/services/notifications";

const ADMIN_INBOX = process.env.BOT_REQUEST_INBOX ?? "contato@marcaiflex.com.br";

const requestSchema = z.object({
  phone: z.string().min(10).max(20),
  notes: z.string().max(500).optional()
});

/** Escapa valores controlados pelo usuário antes de interpolar no HTML do e-mail. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * POST /api/bot-whatsapp/request
 * O cliente solicita a configuração manual do bot (o QR automático não funciona
 * na Evolution v2.2.3). Grava a solicitação em CompanyBotConfig e dispara dois
 * e-mails (best-effort): um para a equipe e um de confirmação para o cliente.
 */
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "settings:manage");
    await requirePlanFeature(context, "allowBotIntegration", "Bot WhatsApp");

    const body = requestSchema.parse(await request.json());
    const phoneDigits = body.phone.replace(/\D/g, "");

    const company = await prisma.company.findUnique({
      where: { id: context.companyId },
      select: {
        name: true,
        tradeName: true,
        users: {
          where: { status: UserStatus.ACTIVE, role: { name: RoleName.COMPANY_ADMIN } },
          select: { user: { select: { name: true, email: true } } },
          take: 1
        }
      }
    });

    if (!company) throw new ApiError(404, "Empresa não encontrada.");

    const companyName = company.tradeName ?? company.name;
    const admin = company.users[0]?.user;

    await prisma.companyBotConfig.upsert({
      where: { companyId: context.companyId },
      update: {
        botRequestPhone: phoneDigits,
        botRequestNotes: body.notes ?? null,
        botRequestStatus: "pending",
        botRequestedAt: new Date()
      },
      create: {
        companyId: context.companyId,
        botRequestPhone: phoneDigits,
        botRequestNotes: body.notes ?? null,
        botRequestStatus: "pending",
        botRequestedAt: new Date(),
        reminderConfig: { enabled: true, send24h: true, send2h: true } as Prisma.InputJsonValue
      }
    });

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://marcaiflex.com.br").replace(/\/+$/, "");
    const requestedAt = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    // E-mail para a equipe.
    sendEmail(
      ADMIN_INBOX,
      `🤖 Nova solicitação de Bot — ${companyName}`,
      `
<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 20px;">
  <div style="background:linear-gradient(135deg,#0d9488,#0f766e);border-radius:12px;padding:20px;margin-bottom:24px;color:#fff;">
    <h2 style="margin:0;font-size:20px;">🤖 Nova solicitação de Bot WhatsApp</h2>
  </div>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:18px;margin-bottom:16px;">
    <p style="margin:0 0 8px;font-size:13px;color:#64748b;text-transform:uppercase;font-weight:700;letter-spacing:0.06em;">Empresa</p>
    <p style="margin:0;font-size:16px;font-weight:700;color:#0f172a;">${esc(companyName)}</p>
  </div>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:18px;margin-bottom:16px;">
    <p style="margin:0 0 8px;font-size:13px;color:#64748b;text-transform:uppercase;font-weight:700;letter-spacing:0.06em;">Responsável</p>
    <p style="margin:0;font-size:15px;color:#0f172a;">${esc(admin?.name ?? "—")} &lt;${esc(admin?.email ?? "—")}&gt;</p>
  </div>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:18px;margin-bottom:16px;">
    <p style="margin:0 0 8px;font-size:13px;color:#64748b;text-transform:uppercase;font-weight:700;letter-spacing:0.06em;">Número para o Bot</p>
    <p style="margin:0;font-size:18px;font-weight:800;color:#0d9488;font-family:monospace;">${esc(body.phone)}</p>
  </div>
  ${
    body.notes
      ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:18px;margin-bottom:16px;">
    <p style="margin:0 0 8px;font-size:13px;color:#64748b;text-transform:uppercase;font-weight:700;letter-spacing:0.06em;">Observações</p>
    <p style="margin:0;font-size:14px;color:#334155;">${esc(body.notes)}</p>
  </div>`
      : ""
  }
  <a href="${appUrl}/master/whatsapp" style="display:block;background:linear-gradient(135deg,#0d9488,#0f766e);color:#fff;text-align:center;padding:14px 24px;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none;margin-top:8px;">Ver no painel Master →</a>
  <p style="text-align:center;font-size:12px;color:#94a3b8;margin-top:20px;">Solicitação recebida em ${requestedAt}</p>
</div>
      `.trim()
    ).catch((err) => console.error("[BotRequest] e-mail equipe falhou:", err));

    // E-mail de confirmação para o cliente.
    if (admin?.email) {
      sendEmail(
        admin.email,
        "✅ Solicitação de Bot WhatsApp recebida — MarcaiFlex",
        `
<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 20px;">
  <div style="text-align:center;margin-bottom:28px;">
    <div style="display:inline-block;background:linear-gradient(135deg,#0d9488,#0f766e);border-radius:14px;width:56px;height:56px;line-height:56px;color:#fff;font-weight:900;font-size:22px;text-align:center;">MF</div>
    <div style="margin-top:10px;font-size:20px;font-weight:800;color:#0f172a;">Marcai<span style="color:#0d9488;">Flex</span></div>
  </div>
  <h2 style="text-align:center;font-size:22px;font-weight:800;color:#0f172a;margin-bottom:8px;">Solicitação recebida! 🎉</h2>
  <p style="text-align:center;color:#64748b;font-size:15px;margin-bottom:28px;">
    Olá, ${esc(admin.name)}! Recebemos sua solicitação para ativar o Bot WhatsApp no <strong>${esc(companyName)}</strong>.
  </p>
  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:18px 20px;margin-bottom:24px;">
    <p style="margin:0;font-size:14px;color:#15803d;line-height:1.6;">
      ✅ <strong>Número solicitado:</strong> ${esc(body.phone)}<br>
      🕐 <strong>Prazo:</strong> Entraremos em contato em até <strong>24 horas úteis</strong> para configurar e ativar o bot.
    </p>
  </div>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
    <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">O que vai acontecer:</p>
    <ol style="margin:0;padding-left:18px;font-size:13.5px;color:#334155;line-height:1.8;">
      <li>Nossa equipe vai entrar em contato pelo e-mail ou WhatsApp</li>
      <li>Você nos passa o acesso temporário ao número informado</li>
      <li>Configuramos e ativamos o bot em poucos minutos</li>
      <li>Pronto — seu bot está atendendo automaticamente!</li>
    </ol>
  </div>
  <p style="text-align:center;font-size:13px;color:#64748b;">Dúvidas? Fale com a gente: <a href="mailto:${esc(ADMIN_INBOX)}" style="color:#0d9488;">${esc(ADMIN_INBOX)}</a></p>
</div>
        `.trim()
      ).catch((err) => console.error("[BotRequest] e-mail cliente falhou:", err));
    }

    return ok({ requested: true });
  } catch (error) {
    return handleApiError(error);
  }
}
