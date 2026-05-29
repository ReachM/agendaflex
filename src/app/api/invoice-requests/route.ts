import { NextRequest } from "next/server";
import { z } from "zod";
import { created, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { requirePlanFeature } from "@/lib/security/plan-guard";
import { issueInvoice } from "@/lib/services/nfeio";

const StatusEnum = z.enum(["NOT_REQUESTED", "REQUESTED", "UNDER_REVIEW", "ISSUED", "SENT_TO_CUSTOMER", "CANCELLED"]);

const createInvoiceSchema = z.object({
  appointmentId: z.string().nullish(),
  customerId: z.string().nullish(),
  legalName: z.string().min(1).max(200),
  documentNumber: z.string().min(11).max(20),
  email: z.string().email().nullish().or(z.literal("")),
  phone: z.string().max(30).nullish(),
  address: z.string().max(200).nullish(),
  number: z.string().max(20).nullish(),
  neighborhood: z.string().max(80).nullish(),
  city: z.string().max(80).nullish(),
  state: z.string().max(2).nullish(),
  zipCode: z.string().max(15).nullish(),
  municipalRegistration: z.string().max(40).nullish(),
  amount: z.coerce.number().positive(),
  issAmount: z.coerce.number().nullish(),
  serviceCode: z.string().max(20).nullish(),
  notes: z.string().max(500).nullish()
});

export async function GET(request: NextRequest) {
  try {
    const context = await requireTenant(request, "invoices:manage");
    await requirePlanFeature(context, "allowInvoiceRequest", "Solicitação de nota fiscal");

    const params = request.nextUrl.searchParams;
    const statusParam = params.get("status");
    const monthParam = params.get("month"); // YYYY-MM

    const where: { companyId: string; status?: z.infer<typeof StatusEnum>; createdAt?: { gte: Date; lt: Date } } = {
      companyId: context.companyId
    };
    if (statusParam) {
      const result = StatusEnum.safeParse(statusParam);
      if (result.success) where.status = result.data;
    }
    if (monthParam) {
      const match = monthParam.match(/^(\d{4})-(\d{2})$/);
      if (match) {
        const year = Number(match[1]);
        const month = Number(match[2]) - 1;
        const startMonth = new Date(year, month, 1);
        const endMonth = new Date(year, month + 1, 1);
        where.createdAt = { gte: startMonth, lt: endMonth };
      }
    }

    const [invoices, statusCounts, config] = await Promise.all([
      prisma.invoiceRequest.findMany({
        where,
        include: {
          appointment: { select: { id: true, startAt: true } },
          customer: { select: { id: true, name: true } },
          requestedBy: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: "desc" },
        take: 200
      }),
      prisma.invoiceRequest.groupBy({
        by: ["status"],
        where: { companyId: context.companyId },
        _count: { id: true }
      }),
      prisma.companyInvoiceConfig.findUnique({ where: { companyId: context.companyId } })
    ]);

    return ok({
      invoices: invoices.map(i => ({ ...i, amount: Number(i.amount), issAmount: i.issAmount !== null ? Number(i.issAmount) : null })),
      statusCounts: statusCounts.map(s => ({ status: s.status, count: s._count.id })),
      hasEmitterConfig: Boolean(config),
      hasNfeioKey: Boolean(config?.nfeioApiKey),
      autoEmit: Boolean(config?.autoEmit && config?.nfeioApiKey)
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "invoices:manage");
    await requirePlanFeature(context, "allowInvoiceRequest", "Solicitação de nota fiscal");
    const body = await request.json();
    const parsed = createInvoiceSchema.parse(body);

    const invoice = await prisma.invoiceRequest.create({
      data: {
        companyId: context.companyId,
        appointmentId: parsed.appointmentId || null,
        customerId: parsed.customerId || null,
        requestedByUserId: context.user.id,
        legalName: parsed.legalName,
        documentNumber: parsed.documentNumber,
        email: parsed.email || null,
        phone: parsed.phone || null,
        address: parsed.address || null,
        number: parsed.number || null,
        neighborhood: parsed.neighborhood || null,
        city: parsed.city || null,
        state: parsed.state || null,
        zipCode: parsed.zipCode || null,
        municipalRegistration: parsed.municipalRegistration || null,
        amount: parsed.amount,
        issAmount: parsed.issAmount ?? null,
        serviceCode: parsed.serviceCode ?? null,
        status: "REQUESTED",
        notes: parsed.notes ?? null
      }
    });

    await audit(request, context, {
      action: "invoice_request.create",
      entityType: "invoice_request",
      entityId: invoice.id,
      newValues: { id: invoice.id, legalName: invoice.legalName, amount: invoice.amount.toString() }
    });

    // Auto-emit via NFE.io (stub) — currently always returns mocked failure
    const config = await prisma.companyInvoiceConfig.findUnique({ where: { companyId: context.companyId } });
    if (config?.autoEmit && config.nfeioApiKey) {
      const result = await issueInvoice({ config, request: invoice });
      if (result.ok && result.nfeioInvoiceId) {
        await prisma.invoiceRequest.update({
          where: { id: invoice.id },
          data: { status: "UNDER_REVIEW", nfeioInvoiceId: result.nfeioInvoiceId }
        });
      } else if (!result.ok) {
        await prisma.invoiceRequest.update({
          where: { id: invoice.id },
          data: { errorMessage: result.errorMessage ?? "Erro na integração NFE.io" }
        });
      }
    }

    return created({ invoice });
  } catch (error) {
    return handleApiError(error);
  }
}
