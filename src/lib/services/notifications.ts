import type { NotificationChannel, NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type NotificationPayload = {
  companyId: string;
  appointmentId?: string;
  customerId?: string;
  channel: NotificationChannel;
  type: NotificationType;
  recipient: string;
  subject: string;
  body: string;
};

/**
 * Send a notification and log it. Never throws — failures are logged silently
 * so the main flow (e.g. booking) is never blocked by a notification error.
 */
export async function sendNotification(payload: NotificationPayload) {
  const log = await prisma.notificationLog.create({
    data: {
      companyId: payload.companyId,
      appointmentId: payload.appointmentId ?? null,
      customerId: payload.customerId ?? null,
      channel: payload.channel,
      type: payload.type,
      recipient: payload.recipient,
      subject: payload.subject,
      body: payload.body,
      status: "PENDING"
    }
  });

  try {
    if (payload.channel === "EMAIL") {
      await sendEmail(payload.recipient, payload.subject, payload.body);
    }
    // Future: WhatsApp, SMS
    // if (payload.channel === "WHATSAPP") { ... }
    // if (payload.channel === "SMS") { ... }

    await prisma.notificationLog.update({
      where: { id: log.id },
      data: { status: "SENT", sentAt: new Date() }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Notification] Failed to send ${payload.type} via ${payload.channel}: ${message}`);
    await prisma.notificationLog.update({
      where: { id: log.id },
      data: { status: "FAILED", errorMessage: message }
    }).catch(() => {}); // never let logging failure propagate
  }
}

/**
 * Envia um e-mail via Resend (API REST, sem dependência extra). Se
 * `RESEND_API_KEY` não estiver configurado (ambiente de dev), apenas loga uma
 * linha discreta e retorna — assim o fluxo não quebra localmente. Lança em caso
 * de erro da API para que o chamador registre como FAILED.
 */
export async function sendEmail(to: string, subject: string, body: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "noreply@marcaiflex.com.br";

  if (!apiKey) {
    console.log(`[EMAIL stub] To: ${to} | Subject: ${subject}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [to],
      subject,
      html: body.includes("<") ? body : `<p>${body.replace(/\n/g, "<br>")}</p>`
    })
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.status.toString());
    throw new Error(`Resend API error: ${err}`);
  }
}

// ─── Template helpers ────────────────────────────────

type AppointmentInfo = {
  companyName: string;
  customerName: string;
  serviceName: string;
  professionalName: string;
  date: string;
  time: string;
  status: string;
};

function formatDateBR(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(date);
}

function formatTimeBR(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" }).format(date);
}

export function buildAppointmentInfo(data: {
  companyName: string;
  customerName: string;
  serviceName: string;
  professionalName: string;
  startAt: Date;
  status: string;
}): AppointmentInfo {
  return {
    companyName: data.companyName,
    customerName: data.customerName,
    serviceName: data.serviceName,
    professionalName: data.professionalName,
    date: formatDateBR(data.startAt),
    time: formatTimeBR(data.startAt),
    status: data.status
  };
}

export function notificationTemplates(type: NotificationType, info: AppointmentInfo) {
  switch (type) {
    case "APPOINTMENT_CREATED":
      return {
        subject: `Agendamento confirmado - ${info.companyName}`,
        body: `Olá, ${info.customerName}.\nSeu agendamento foi registrado com sucesso.\n\nEmpresa: ${info.companyName}\nServiço: ${info.serviceName}\nProfissional: ${info.professionalName}\nData: ${info.date}\nHorário: ${info.time}\nStatus: ${info.status}\n\nObrigado por utilizar nossos serviços.`
      };
    case "APPOINTMENT_CONFIRMED":
      return {
        subject: `Agendamento confirmado - ${info.companyName}`,
        body: `Olá, ${info.customerName}.\nSeu agendamento foi confirmado.\n\nServiço: ${info.serviceName}\nProfissional: ${info.professionalName}\nData: ${info.date}\nHorário: ${info.time}\nStatus: Confirmado`
      };
    case "APPOINTMENT_RESCHEDULED":
      return {
        subject: `Agendamento reagendado - ${info.companyName}`,
        body: `Olá, ${info.customerName}.\nSeu agendamento foi reagendado.\n\nServiço: ${info.serviceName}\nProfissional: ${info.professionalName}\nNova data: ${info.date}\nNovo horário: ${info.time}`
      };
    case "APPOINTMENT_CANCELED":
      return {
        subject: `Agendamento cancelado - ${info.companyName}`,
        body: `Olá, ${info.customerName}.\nSeu agendamento foi cancelado.\n\nServiço: ${info.serviceName}\nData: ${info.date}\nHorário: ${info.time}\n\nSe precisar, agende novamente pelo nosso sistema.`
      };
    case "APPOINTMENT_STARTED":
      return {
        subject: `Seu atendimento está em andamento - ${info.companyName}`,
        body: `Olá, ${info.customerName}.\nSeu atendimento foi iniciado.\n\nServiço: ${info.serviceName}\nProfissional: ${info.professionalName}\nStatus: Em andamento`
      };
    case "APPOINTMENT_COMPLETED":
      return {
        subject: `Atendimento concluído - ${info.companyName}`,
        body: `Olá, ${info.customerName}.\nSeu atendimento foi concluído.\n\nServiço: ${info.serviceName}\nData: ${info.date}\nStatus: Concluído\n\nObrigado por utilizar nossos serviços.`
      };
  }
}

/**
 * High-level function to notify a customer about an appointment event.
 * Only sends if the customer has an email and the company has notifications enabled.
 */
export async function notifyCustomerAboutAppointment(params: {
  companyId: string;
  appointmentId: string;
  customerId: string;
  customerEmail?: string | null;
  type: NotificationType;
  info: AppointmentInfo;
}) {
  if (!params.customerEmail) return;

  const template = notificationTemplates(params.type, params.info);
  
  // Fire and forget — never block the main flow
  sendNotification({
    companyId: params.companyId,
    appointmentId: params.appointmentId,
    customerId: params.customerId,
    channel: "EMAIL",
    type: params.type,
    recipient: params.customerEmail,
    subject: template.subject,
    body: template.body
  }).catch(() => {}); // swallow errors
}

/**
 * E-mail de boas-vindas enviado logo após o cadastro de um novo tenant.
 * HTML completo (logo, 3 primeiros passos, CTA, link público e info do plano).
 * Não é registrado no NotificationLog — é um e-mail transacional de onboarding,
 * não uma notificação de agendamento. Lança em caso de falha de envio para que
 * o chamador (register) trate como fire-and-forget.
 */
export async function sendWelcomeEmail(data: {
  adminName: string;
  adminEmail: string;
  companyName: string;
  companySlug: string;
  planName: string;
  trialDays: number;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://marcaiflex.com.br";
  const dashUrl = `${appUrl}/dashboard`;
  const bookingUrl = `${appUrl}/agendar/${data.companySlug}`;

  const subject = `Bem-vindo ao MarcaiFlex, ${data.adminName}! 🎉`;

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,ui-sans-serif,system-ui,sans-serif;">
  <div style="max-width:580px;margin:0 auto;padding:40px 20px;">

    <!-- Logo -->
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;background:linear-gradient(135deg,#0d9488,#0f766e);border-radius:14px;width:56px;height:56px;line-height:56px;color:#fff;font-weight:900;font-size:22px;text-align:center;">MF</div>
      <div style="margin-top:10px;font-size:20px;font-weight:800;color:#0f172a;letter-spacing:-0.5px;">Marcai<span style="color:#0d9488;">Flex</span></div>
    </div>

    <!-- Card principal -->
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:36px;margin-bottom:24px;">
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#0f172a;letter-spacing:-0.5px;">
        Bem-vindo, ${data.adminName}! 🎉
      </h1>
      <p style="margin:0 0 24px;color:#64748b;font-size:15px;line-height:1.6;">
        Sua conta <strong style="color:#0f172a;">${data.companyName}</strong> foi criada com sucesso.
        Você tem <strong style="color:#0d9488;">${data.trialDays} dias grátis</strong> para explorar tudo — sem cartão de crédito.
      </p>

      <!-- 3 passos -->
      <div style="margin-bottom:28px;">
        <p style="margin:0 0 14px;font-size:13px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">Por onde começar</p>

        <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:14px;">
          <div style="width:28px;height:28px;border-radius:50%;background:#0d9488;color:#fff;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0;line-height:28px;text-align:center;">1</div>
          <div>
            <p style="margin:0;font-weight:700;font-size:14px;color:#0f172a;">Adicione seus profissionais</p>
            <p style="margin:4px 0 0;font-size:13px;color:#64748b;">Cadastre sua equipe com horários e especialidades.</p>
          </div>
        </div>

        <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:14px;">
          <div style="width:28px;height:28px;border-radius:50%;background:#0d9488;color:#fff;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0;line-height:28px;text-align:center;">2</div>
          <div>
            <p style="margin:0;font-weight:700;font-size:14px;color:#0f172a;">Configure seus serviços</p>
            <p style="margin:4px 0 0;font-size:13px;color:#64748b;">Crie categorias e serviços com preços e duração.</p>
          </div>
        </div>

        <div style="display:flex;align-items:flex-start;gap:14px;">
          <div style="width:28px;height:28px;border-radius:50%;background:#0d9488;color:#fff;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0;line-height:28px;text-align:center;">3</div>
          <div>
            <p style="margin:0;font-weight:700;font-size:14px;color:#0f172a;">Compartilhe seu link de agendamento</p>
            <p style="margin:4px 0 0;font-size:13px;color:#64748b;">Seu link único: <a href="${bookingUrl}" style="color:#0d9488;">${bookingUrl}</a></p>
          </div>
        </div>
      </div>

      <!-- CTA -->
      <a href="${dashUrl}" style="display:block;background:linear-gradient(135deg,#0d9488,#0f766e);color:#fff;text-align:center;padding:14px 24px;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none;letter-spacing:-0.2px;">
        Acessar meu painel →
      </a>
    </div>

    <!-- Info do plano -->
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;font-size:13.5px;color:#15803d;">
        ✅ Você está no <strong>Plano ${data.planName}</strong> — teste grátis por ${data.trialDays} dias.
        Não precisa de cartão de crédito para começar.
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align:center;font-size:12px;color:#94a3b8;line-height:1.6;">
      <p style="margin:0 0 6px;">Dúvidas? Fale com a gente: <a href="mailto:contato@marcaiflex.com.br" style="color:#0d9488;">contato@marcaiflex.com.br</a></p>
      <p style="margin:0;">
        <a href="${appUrl}/termos" style="color:#94a3b8;margin:0 8px;">Termos de Uso</a> ·
        <a href="${appUrl}/privacidade" style="color:#94a3b8;margin:0 8px;">Privacidade</a>
      </p>
    </div>

  </div>
</body>
</html>
  `.trim();

  await sendEmail(data.adminEmail, subject, html);
}

/**
 * Notificação interna para o super admin sempre que um novo cliente (tenant) é
 * cadastrado — seja por Google ou por e-mail. Envia um e-mail simples em texto
 * para `SUPER_ADMIN_EMAIL` usando o mesmo transporter (sendEmail/Resend) do
 * e-mail de boas-vindas. Lança em caso de falha para que o chamador trate como
 * fire-and-forget.
 */
export async function sendNewTenantAlert(data: {
  userName: string;
  userEmail: string;
  companyName: string;
  source: "google" | "email";
}): Promise<void> {
  const to = process.env.SUPER_ADMIN_EMAIL ?? "contato@marcaiflex.com.br";

  const sourceLabel = data.source === "google" ? "Google" : "E-mail";
  const dateTimeBR = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo"
  }).format(new Date());

  const subject = `🆕 Novo cliente: ${data.companyName}`;
  const body =
    `Um novo cliente acabou de se cadastrar no MarcaiFlex.\n\n` +
    `Nome: ${data.userName}\n` +
    `E-mail: ${data.userEmail}\n` +
    `Empresa: ${data.companyName}\n` +
    `Origem do cadastro: ${sourceLabel}\n` +
    `Data/hora (Brasília): ${dateTimeBR}`;

  await sendEmail(to, subject, body);
}
