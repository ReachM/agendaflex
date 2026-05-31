import { AppointmentStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { ApiError, created, handleApiError, ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/security/rate-limit";
import { ensureNoConflict } from "@/lib/services/availability";
import { buildAppointmentInfo, notifyCustomerAboutAppointment } from "@/lib/services/notifications";
import crypto from "crypto";

/**
 * Public booking page — no authentication required.
 * GET: Returns company info, services, professionals, available slots, booking settings.
 * POST: Creates a booking request from the client.
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const company = await prisma.company.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        tradeName: true,
        phone: true,
        segment: true,
        status: true,
        settings: true,
        publicBookingEnabled: true,
        autoConfirmBooking: true
      }
    });

    if (!company || company.status !== "ACTIVE" || !company.publicBookingEnabled) {
      throw new ApiError(404, "Página de agendamento não encontrada ou desativada.");
    }

    // Load booking settings
    const settings = await prisma.publicBookingSettings.findUnique({
      where: { companyId: company.id }
    });

    const isHealthSegment = ["CLINICA_MEDICA", "CONSULTORIO"].includes(company.segment);

    const [services, professionals, publicFields] = await Promise.all([
      prisma.service.findMany({
        where: { companyId: company.id, isActive: true, isPublic: true },
        select: { id: true, name: true, description: true, basePrice: true, durationMinutes: true },
        orderBy: { name: "asc" }
      }),
      prisma.professional.findMany({
        where: { companyId: company.id, isActive: true, isPublic: true },
        select: { id: true, name: true, specialty: true },
        orderBy: { name: "asc" }
      }),
      prisma.customField.findMany({
        where: { companyId: company.id, entityType: "APPOINTMENT", isPublic: true, isActive: true },
        select: { id: true, label: true, fieldKey: true, fieldType: true, isRequired: true, options: true, placeholder: true, helpText: true },
        orderBy: { sortOrder: "asc" }
      })
    ]);

    const companySettings = (company.settings ?? {}) as Record<string, unknown>;

    return ok({
      company: {
        name: company.name,
        tradeName: company.tradeName,
        phone: company.phone,
        segment: company.segment,
        isHealthSegment,
        businessHours: (companySettings.businessHours as Record<string, { open: boolean; from?: string; to?: string }> | undefined) ?? null
      },
      services,
      professionals,
      publicFields,
      settings: {
        allowChooseProfessional: settings?.allowChooseProfessional ?? true,
        minNoticeHours: settings?.minNoticeHours ?? 1,
        maxDaysAhead: settings?.maxDaysAhead ?? 30,
        slotIntervalMinutes: settings?.slotIntervalMinutes ?? 30,
        instructions: settings?.instructions ?? null,
        confirmationMessage: settings?.confirmationMessage ?? null,
        requireManualApproval: settings?.requireManualApproval ?? false
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Rate limit by IP
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    rateLimit(`public_booking:${ip}`, 10, 60 * 1000); // 10 bookings per minute per IP

    const company = await prisma.company.findUnique({
      where: { slug },
      select: { id: true, name: true, tradeName: true, segment: true, status: true, publicBookingEnabled: true, autoConfirmBooking: true }
    });

    if (!company || company.status !== "ACTIVE" || !company.publicBookingEnabled) {
      throw new ApiError(404, "Página de agendamento não encontrada ou desativada.");
    }

    const body = await request.json();

    // Sanitize inputs
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
    const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 30) : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 255) : "";
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : "";
    const cpf = typeof body.cpf === "string" ? body.cpf.trim().slice(0, 20) : "";
    const lgpdAccepted = body.lgpdAccepted === true;

    // Health-specific fields
    const healthInsurance = typeof body.healthInsurance === "string" ? body.healthInsurance.trim().slice(0, 200) : "";
    const healthInsuranceNumber = typeof body.healthInsuranceNumber === "string" ? body.healthInsuranceNumber.trim().slice(0, 100) : "";
    const allergies = typeof body.allergies === "string" ? body.allergies.trim().slice(0, 1000) : "";
    const requiredCare = typeof body.requiredCare === "string" ? body.requiredCare.trim().slice(0, 1000) : "";

    if (!name || !phone || !body.serviceId || !body.professionalId || !body.startAt || !body.endAt) {
      throw new ApiError(422, "Campos obrigatórios: nome, telefone, serviço, profissional, data/horário.");
    }

    if (!lgpdAccepted) {
      throw new ApiError(422, "Você precisa aceitar a política de privacidade para continuar.");
    }

    // Validate service and professional belong to this company
    const [service, professional] = await Promise.all([
      prisma.service.findFirst({ where: { id: body.serviceId, companyId: company.id, isActive: true, isPublic: true } }),
      prisma.professional.findFirst({ where: { id: body.professionalId, companyId: company.id, isActive: true, isPublic: true } })
    ]);

    if (!service) throw new ApiError(422, "Serviço indisponível.");
    if (!professional) throw new ApiError(422, "Profissional indisponível.");

    const startAt = new Date(body.startAt);
    const endAt = new Date(body.endAt);
    const now = new Date();

    // Validate minimum notice
    const settings = await prisma.publicBookingSettings.findUnique({
      where: { companyId: company.id }
    });
    const minNoticeMs = (settings?.minNoticeHours ?? 1) * 60 * 60 * 1000;
    if (startAt.getTime() < now.getTime() + minNoticeMs) {
      throw new ApiError(422, "O horário selecionado não respeita a antecedência mínima.");
    }

    // Validate max days ahead
    const maxDaysMs = (settings?.maxDaysAhead ?? 30) * 24 * 60 * 60 * 1000;
    if (startAt.getTime() > now.getTime() + maxDaysMs) {
      throw new ApiError(422, "A data selecionada ultrapassa o limite de dias futuros.");
    }

    // Use a transactional approach to avoid race conditions
    const result = await prisma.$transaction(async (tx) => {
      // Check for scheduling conflicts inside transaction (lógica única)
      await ensureNoConflict(
        { companyId: company.id, professionalId: body.professionalId, startAt, endAt },
        tx,
        "Esse horário acabou de ficar indisponível. Escolha outro horário."
      );

      // Find or create customer
      let customer = await tx.customer.findFirst({
        where: {
          companyId: company.id,
          OR: [
            { phone },
            ...(email ? [{ email }] : [])
          ],
          deletedAt: null
        }
      });

      const isHealthSegment = ["CLINICA_MEDICA", "CONSULTORIO"].includes(company.segment);

      if (!customer) {
        customer = await tx.customer.create({
          data: {
            companyId: company.id,
            name,
            phone,
            whatsapp: phone,
            email: email || null,
            cpf: cpf || null,
            notes: notes || null,
            origin: "OUTRO",
            ...(isHealthSegment ? {
              healthInsurance: healthInsurance || null,
              healthInsuranceNumber: healthInsuranceNumber || null,
              allergies: allergies || null,
              requiredCare: requiredCare || null
            } : {})
          }
        });
      } else {
        // Update customer info if provided. companyId no WHERE é defesa em
        // profundidade: o findFirst acima já isolou por tenant, mas se em
        // algum dia o caminho mudar, o update continua tenant-safe.
        await tx.customer.update({
          where: { id: customer.id, companyId: company.id },
          data: {
            name,
            ...(email ? { email } : {}),
            ...(phone ? { whatsapp: phone } : {}),
            ...(isHealthSegment && healthInsurance ? { healthInsurance } : {}),
            ...(isHealthSegment && healthInsuranceNumber ? { healthInsuranceNumber } : {}),
            ...(isHealthSegment && allergies ? { allergies } : {}),
            ...(isHealthSegment && requiredCare ? { requiredCare } : {})
          }
        });
      }

      const useManualApproval = settings?.requireManualApproval ?? !company.autoConfirmBooking;
      const appointmentStatus = useManualApproval ? AppointmentStatus.SCHEDULED : AppointmentStatus.CONFIRMED;
      const approvalStatus = useManualApproval ? "PENDING" : "APPROVED";
      const publicBookingToken = crypto.randomBytes(16).toString("hex");

      const appointment = await tx.appointment.create({
        data: {
          companyId: company.id,
          customerId: customer.id,
          serviceId: service.id,
          professionalId: professional.id,
          startAt,
          endAt,
          status: appointmentStatus,
          notes: notes || null,
          bookedByClient: true,
          source: "PUBLIC_LINK",
          approvalStatus: approvalStatus as any,
          publicBookingToken,
          appointmentServices: {
            create: {
              companyId: company.id,
              serviceId: service.id,
              serviceNameSnapshot: service.name,
              unitPrice: service.basePrice,
              totalPrice: service.basePrice
            }
          }
        }
      });

      return { appointment, customer, appointmentStatus };
    });

    // Audit log (outside transaction)
    await prisma.auditLog.create({
      data: {
        companyId: company.id,
        action: "appointment.public_booking",
        entityType: "appointment",
        entityId: result.appointment.id,
        newValues: {
          customerName: name,
          service: service.name,
          professional: professional.name,
          startAt: startAt.toISOString(),
          source: "PUBLIC_LINK",
          lgpdAccepted: true
        },
        ipAddress: ip
      }
    });

    // Send notification (fire and forget)
    const shouldNotify = settings?.sendEmailNotifications !== false;
    if (shouldNotify && (email || result.customer.email)) {
      const info = buildAppointmentInfo({
        companyName: company.tradeName ?? company.name,
        customerName: name,
        serviceName: service.name,
        professionalName: professional.name,
        startAt,
        status: result.appointmentStatus === "CONFIRMED" ? "Confirmado" : "Pendente"
      });

      notifyCustomerAboutAppointment({
        companyId: company.id,
        appointmentId: result.appointment.id,
        customerId: result.customer.id,
        customerEmail: email || result.customer.email,
        type: "APPOINTMENT_CREATED",
        info
      });
    }

    const confirmationMessage = settings?.confirmationMessage ?? (
      company.autoConfirmBooking
        ? "Agendamento confirmado com sucesso!"
        : "Solicitação de agendamento enviada. Aguarde a confirmação."
    );

    return created({
      message: confirmationMessage,
      appointmentId: result.appointment.id,
      status: result.appointmentStatus,
      publicToken: result.appointment.publicBookingToken
    });
  } catch (error) {
    return handleApiError(error);
  }
}
