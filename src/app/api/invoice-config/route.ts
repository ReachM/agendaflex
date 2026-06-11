import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { requirePlanFeature } from "@/lib/security/plan-guard";
import { createNfeioCompany } from "@/lib/services/nfeio";

const upsertConfigSchema = z.object({
  cnpj: z.string().min(14).max(20),
  legalName: z.string().min(1).max(200),
  municipalRegistration: z.string().max(40).nullish(),
  stateRegistration: z.string().max(40).nullish(),
  issRate: z.coerce.number().min(0).max(100).nullish(),
  serviceCode: z.string().max(20).nullish(),
  taxRegime: z.enum(["SIMPLES", "NORMAL"]).nullish(),
  nfeioCompanyId: z.string().max(100).nullish(),
  autoEmit: z.boolean().optional(),
  notes: z.string().max(500).nullish()
});

export async function GET(request: NextRequest) {
  try {
    const context = await requireTenant(request, "invoices:manage");
    await requirePlanFeature(context, "allowInvoiceRequest", "Solicitação de nota fiscal");

    const config = await prisma.companyInvoiceConfig.findUnique({ where: { companyId: context.companyId } });
    const hasNfeioIntegration = Boolean(process.env.NFE_IO_API_KEY);

    if (!config) {
      return ok({
        config: null,
        hasNfeioKey: false, // deprecated — mantido para compatibilidade
        hasNfeioIntegration,
        nfeioCompanyRegistered: false
      });
    }

    return ok({
      config: {
        ...config,
        issRate: config.issRate !== null ? Number(config.issRate) : null
      },
      hasNfeioKey: false, // deprecated — chave por empresa não existe mais
      hasNfeioIntegration,
      nfeioCompanyRegistered: Boolean(config.nfeioCompanyId)
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

    const existing = await prisma.companyInvoiceConfig.findUnique({ where: { companyId: context.companyId } });

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
        // Preserva o id já cadastrado se o cliente não reenviar — evita
        // zerar o vínculo e recadastrar a empresa em duplicidade no NFE.io.
        nfeioCompanyId: parsed.nfeioCompanyId ?? existing?.nfeioCompanyId ?? null,
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
        autoEmit: parsed.autoEmit
      }
    });

    // Primeira vez que os dados fiscais são salvos e ainda não há empresa no
    // NFE.io: tenta cadastrar e salvar o id. Fire-and-forget — nunca bloqueia
    // nem quebra o save (roda em processo persistente via pm2).
    if (!config.nfeioCompanyId && process.env.NFE_IO_API_KEY) {
      createNfeioCompany({
        cnpj: parsed.cnpj,
        legalName: parsed.legalName,
        municipalRegistration: parsed.municipalRegistration ?? undefined
      })
        .then(async (result) => {
          if (result.ok && result.nfeioCompanyId) {
            await prisma.companyInvoiceConfig.update({
              where: { companyId: context.companyId },
              data: { nfeioCompanyId: result.nfeioCompanyId }
            });
          }
        })
        .catch(() => {});
    }

    return ok({
      config: {
        ...config,
        issRate: config.issRate !== null ? Number(config.issRate) : null
      },
      hasNfeioKey: false, // deprecated
      hasNfeioIntegration: Boolean(process.env.NFE_IO_API_KEY),
      nfeioCompanyRegistered: Boolean(config.nfeioCompanyId)
    });
  } catch (error) {
    return handleApiError(error);
  }
}
