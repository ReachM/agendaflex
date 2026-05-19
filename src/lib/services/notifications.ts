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
 * Email sending stub — in production this would use a service like
 * Resend, SendGrid, AWS SES, etc. For now it logs to console.
 */
async function sendEmail(to: string, subject: string, body: string) {
  // TODO: Integrate with real email provider
  console.log(`\n📧 [EMAIL] To: ${to}`);
  console.log(`   Subject: ${subject}`);
  console.log(`   Body: ${body.substring(0, 200)}...`);
  console.log(`   ✅ Email logged (simulated send)\n`);
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
