import { NextRequest, NextResponse } from "next/server";
import { created, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { requirePlanFeature } from "@/lib/security/plan-guard";

// TODO [MVP-FUTURE] Remover bloqueio MVP quando o módulo de notas fiscais for reativado na v2
const MVP_BLOCK = NextResponse.json(
  { error: "Funcionalidade em desenvolvimento e indisponível nesta versão." },
  { status: 403 }
);

export async function GET(request: NextRequest) {
  return MVP_BLOCK;
  try {
    const context = await requireTenant(request, "invoices:manage");
    await requirePlanFeature(context, "allowInvoiceRequest", "Solicitação de nota fiscal");

    const invoices = await prisma.invoiceRequest.findMany({
      where: { companyId: context.companyId },
      include: {
        appointment: { select: { id: true, startAt: true } },
        customer: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });

    return ok({ invoices });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  return MVP_BLOCK;
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "invoices:manage");
    await requirePlanFeature(context, "allowInvoiceRequest", "Solicitação de nota fiscal");
    const body = await request.json();

    const invoice = await prisma.invoiceRequest.create({
      data: {
        companyId: context.companyId,
        appointmentId: body.appointmentId || null,
        customerId: body.customerId || null,
        requestedByUserId: context.user.id,
        legalName: body.legalName,
        documentNumber: body.documentNumber,
        email: body.email,
        phone: body.phone,
        address: body.address,
        number: body.number,
        neighborhood: body.neighborhood,
        city: body.city,
        state: body.state,
        zipCode: body.zipCode,
        municipalRegistration: body.municipalRegistration,
        amount: body.amount,
        status: "REQUESTED",
        notes: body.notes
      }
    });

    await audit(request, context, {
      action: "invoice_request.create",
      entityType: "invoice_request",
      entityId: invoice.id,
      newValues: { id: invoice.id, legalName: invoice.legalName, amount: invoice.amount }
    });

    return created({ invoice });
  } catch (error) {
    return handleApiError(error);
  }
}
