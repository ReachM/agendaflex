import { NextRequest } from "next/server";
import { z } from "zod";
import { created, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { requirePlanFeature } from "@/lib/security/plan-guard";

const ItemTypeEnum = z.enum(["CHECKBOX", "NOTE", "PHOTO"]);
const TemplateStatusEnum = z.enum(["DRAFT", "ACTIVE", "PAUSED"]);

const createTemplateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullish(),
  status: TemplateStatusEnum.default("DRAFT"),
  estimatedMinutes: z.coerce.number().int().min(0).nullish(),
  sections: z.array(z.object({
    name: z.string().min(1).max(80),
    items: z.array(z.object({
      description: z.string().min(1).max(200),
      itemType: ItemTypeEnum.default("CHECKBOX"),
      isRequired: z.boolean().default(false),
      helpText: z.string().max(200).nullish()
    })).default([])
  })).default([])
});

export async function GET(request: NextRequest) {
  try {
    const context = await requireTenant(request, "checklists:view");
    await requirePlanFeature(context, "allowCustomerChecklist", "Checklists");

    const status = request.nextUrl.searchParams.get("status");
    const where: { companyId: string; status?: "DRAFT" | "ACTIVE" | "PAUSED" } = { companyId: context.companyId };
    if (status === "DRAFT" || status === "ACTIVE" || status === "PAUSED") where.status = status;

    const templates = await prisma.checklistTemplate.findMany({
      where,
      include: {
        sections: {
          orderBy: { sortOrder: "asc" },
          include: { items: { orderBy: { sortOrder: "asc" } } }
        },
        services: { select: { id: true, name: true } },
        _count: { select: { instances: true } }
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }]
    });

    const [activeCount, pausedCount, draftCount, totalInstances] = await Promise.all([
      prisma.checklistTemplate.count({ where: { companyId: context.companyId, status: "ACTIVE" } }),
      prisma.checklistTemplate.count({ where: { companyId: context.companyId, status: "PAUSED" } }),
      prisma.checklistTemplate.count({ where: { companyId: context.companyId, status: "DRAFT" } }),
      prisma.checklist.count({ where: { companyId: context.companyId, templateId: { not: null } } })
    ]);

    return ok({
      templates,
      stats: {
        activeCount,
        pausedCount,
        draftCount,
        totalInstances
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "checklists:manage");
    await requirePlanFeature(context, "allowCustomerChecklist", "Checklists");
    const body = await request.json();
    const parsed = createTemplateSchema.parse(body);

    const template = await prisma.checklistTemplate.create({
      data: {
        companyId: context.companyId,
        name: parsed.name,
        description: parsed.description ?? null,
        status: parsed.status,
        estimatedMinutes: parsed.estimatedMinutes ?? null,
        sortOrder: 0,
        sections: {
          create: parsed.sections.map((sec, sIdx) => ({
            companyId: context.companyId,
            name: sec.name,
            sortOrder: sIdx,
            items: {
              create: sec.items.map((it, iIdx) => ({
                companyId: context.companyId,
                description: it.description,
                itemType: it.itemType,
                isRequired: it.isRequired,
                helpText: it.helpText ?? null,
                sortOrder: iIdx
              }))
            }
          }))
        }
      },
      include: {
        sections: {
          orderBy: { sortOrder: "asc" },
          include: { items: { orderBy: { sortOrder: "asc" } } }
        }
      }
    });

    await audit(request, context, {
      action: "checklist_template.create",
      entityType: "checklist_template",
      entityId: template.id,
      newValues: { id: template.id, name: template.name, status: template.status }
    });

    return created({ template });
  } catch (error) {
    return handleApiError(error);
  }
}
