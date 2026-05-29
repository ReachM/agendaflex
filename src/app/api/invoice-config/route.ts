import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { requirePlanFeature } from "@/lib/security/plan-guard";

const upsertConfigSchema = z.object({
  cnpj: z.string().min(14).max(20),
  legalName: z.string().min(1).max(200),
  municipalRegistration: z.string().max(40).nullish(),
  stateRegistration: z.string().max(40).nullish(),
  issRate: z.coerce.number().min(0).max(100).nullish(),
  serviceCode: z.string().max(20).nullish(),
  taxRegime: z.enum(["SIMPLES", "NORMAL"]).nullish(),
  nfeioApiKey: z.string().max(200).nullish(),
  nfeioCompanyId: z.string().max(100).nullish(),
  autoEmit: z.boolean().optional(),
  notes: z.string().max(500).nullish()
});

function maskKey(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 8) return "•".repeat(value.length);
  return `${value.slice(0, 4)}${"•".repeat(value.length - 8)}${value.slice(-4)}`;
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireTenant(request, "invoices:manage");
    await requirePlanFeature(context, "allowInvoiceRequest", "Solicitação de nota fiscal");

    const config = await prisma.companyInvoiceConfig.findUnique({ where: { companyId: context.companyId } });
    if (!config) return ok({ config: null, hasNfeioKey: false });

    // Never expose the raw NFE.io API key. Return a masked preview only.
    return ok({
      config: {
        ...config,
        issRate: config.issRate !== null ? Number(config.issRate) : null,
        nfeioApiKey: maskKey(config.nfeioApiKey)
      },
      hasNfeioKey: Boolean(config.nfeioApiKey)
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "invoices:manage");
    await requirePlanFeature(context, "allowInvoiceRequest", "Solicitação de nota fiscal");
    const body = await request.json();
    const parsed = upsertConfigSchema.parse(body);

    // If client sent masked key (contains •), keep existing
    const existing = await prisma.companyInvoiceConfig.findUnique({ where: { companyId: context.companyId } });
    const apiKeyToSave = parsed.nfeioApiKey && parsed.nfeioApiKey.includes("•")
      ? existing?.nfeioApiKey ?? null
      : parsed.nfeioApiKey ?? null;

    const config = await prisma.companyInvoiceConfig.upsert({
      where: { companyId: context.companyId },
      update: {
        cnpj: parsed.cnpj,
        legalName: parsed.legalName,
        municipalRegistration: parsed.municipalRegistration ?? null,
        stateRegistration: parsed.stateRegistration ?? null,
        issRate: parsed.issRate ?? null,
        serviceCode: parsed.serviceCode ?? null,
        taxRegime: parsed.taxRegime ?? null,
        nfeioApiKey: apiKeyToSave,
        nfeioCompanyId: parsed.nfeioCompanyId ?? null,
        autoEmit: parsed.autoEmit ?? false,
        notes: parsed.notes ?? null
      },
      create: {
        companyId: context.companyId,
        cnpj: parsed.cnpj,
        legalName: parsed.legalName,
        municipalRegistration: parsed.municipalRegistration ?? null,
        stateRegistration: parsed.stateRegistration ?? null,
        issRate: parsed.issRate ?? null,
        serviceCode: parsed.serviceCode ?? null,
        taxRegime: parsed.taxRegime ?? null,
        nfeioApiKey: apiKeyToSave,
        nfeioCompanyId: parsed.nfeioCompanyId ?? null,
        autoEmit: parsed.autoEmit ?? false,
        notes: parsed.notes ?? null
      }
    });

    await audit(request, context, {
      action: "invoice_config.upsert",
      entityType: "invoice_config",
      entityId: config.id,
      newValues: {
        cnpj: parsed.cnpj,
        legalName: parsed.legalName,
        autoEmit: parsed.autoEmit,
        hasNfeioKey: Boolean(apiKeyToSave)
      }
    });

    return ok({
      config: {
        ...config,
        issRate: config.issRate !== null ? Number(config.issRate) : null,
        nfeioApiKey: maskKey(config.nfeioApiKey)
      },
      hasNfeioKey: Boolean(config.nfeioApiKey)
    });
  } catch (error) {
    return handleApiError(error);
  }
}
