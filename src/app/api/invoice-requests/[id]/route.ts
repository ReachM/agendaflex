import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { requirePlanFeature } from "@/lib/security/plan-guard";

const updateInvoiceSchema = z.object({
  status: z.enum(["NOT_REQUESTED", "REQUESTED", "UNDER_REVIEW", "ISSUED", "SENT_TO_CUSTOMER", "CANCELLED"]).optional(),
  invoiceNumber: z.string().max(40).nullish(),
  fileUrl: z.string().url().nullish().or(z.literal("")),
  issuedAt: z.string().nullish(),
  errorMessage: z.string().max(500).nullish(),
  notes: z.string().max(500).nullish()
});

async function loadOwned(id: string, companyId: string) {
  const invoice = await prisma.invoiceRequest.findFirst({ where: { id, companyId } });
  if (!invoice) throw new ApiError(404, "Nota fiscal não encontrada");
  return invoice;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireTenant(request, "invoices:manage");
    await requirePlanFeature(context, "allowInvoiceRequest", "Solicitação de nota fiscal");
    const { id } = await params;
    const invoice = await prisma.invoiceRequest.findFirst({
      where: { id, companyId: context.companyId },
      include: {
        appointment: { select: { id: true, startAt: true } },
        customer: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, name: true } }
      }
    });
    if (!invoice) throw new ApiError(404, "Nota fiscal não encontrada");
    return ok({
      invoice: {
        ...invoice,
        amount: Number(invoice.amount),
        issAmount: invoice.issAmount !== null ? Number(invoice.issAmount) : null
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "invoices:manage");
    await requirePlanFeature(context, "allowInvoiceRequest", "Solicitação de nota fiscal");
    const { id } = await params;
    const existing = await loadOwned(id, context.companyId);
    const body = await request.json();
    const parsed = updateInvoiceSchema.parse(body);

    const updated = await prisma.invoiceRequest.update({
      where: { id },
      data: {
        ...(parsed.status !== undefined ? { status: parsed.status } : {}),
        ...(parsed.invoiceNumber !== undefined ? { invoiceNumber: parsed.invoiceNumber } : {}),
        ...(parsed.fileUrl !== undefined ? { fileUrl: parsed.fileUrl || null } : {}),
        ...(parsed.issuedAt !== undefined ? { issuedAt: parsed.issuedAt ? new Date(parsed.issuedAt) : null } : {}),
        ...(parsed.errorMessage !== undefined ? { errorMessage: parsed.errorMessage } : {}),
        ...(parsed.notes !== undefined ? { notes: parsed.notes } : {})
      }
    });

    await audit(request, context, {
      action: "invoice_request.update",
      entityType: "invoice_request",
      entityId: id,
      oldValues: { status: existing.status, invoiceNumber: existing.invoiceNumber },
      newValues: parsed
    });

    return ok({ invoice: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "invoices:manage");
    await requirePlanFeature(context, "allowInvoiceRequest", "Solicitação de nota fiscal");
    const { id } = await params;
    const existing = await loadOwned(id, context.companyId);

    // If already issued, mark as CANCELLED instead of hard delete
    if (existing.status === "ISSUED" || existing.status === "SENT_TO_CUSTOMER") {
      await prisma.invoiceRequest.update({ where: { id }, data: { status: "CANCELLED" } });
    } else {
      await prisma.invoiceRequest.delete({ where: { id } });
    }

    await audit(request, context, {
      action: "invoice_request.delete",
      entityType: "invoice_request",
      entityId: id
    });

    return ok({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
