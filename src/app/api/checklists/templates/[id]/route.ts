import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { requirePlanFeature } from "@/lib/security/plan-guard";

const ItemTypeEnum = z.enum(["CHECKBOX", "NOTE", "PHOTO"]);
const TemplateStatusEnum = z.enum(["DRAFT", "ACTIVE", "PAUSED"]);

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).nullish(),
  status: TemplateStatusEnum.optional(),
  estimatedMinutes: z.coerce.number().int().min(0).nullish(),
  sortOrder: z.coerce.number().int().min(0).optional()
});

const structureSchema = z.object({
  sections: z.array(z.object({
    id: z.string().optional(),
    name: z.string().min(1).max(80),
    sortOrder: z.coerce.number().int().min(0).default(0),
    items: z.array(z.object({
      id: z.string().optional(),
      description: z.string().min(1).max(200),
      itemType: ItemTypeEnum.default("CHECKBOX"),
      isRequired: z.boolean().default(false),
      helpText: z.string().max(200).nullish(),
      sortOrder: z.coerce.number().int().min(0).default(0)
    }))
  }))
});

async function loadOwned(id: string, companyId: string) {
  const template = await prisma.checklistTemplate.findFirst({ where: { id, companyId } });
  if (!template) throw new ApiError(404, "Template não encontrado");
  return template;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireTenant(request, "checklists:view");
    await requirePlanFeature(context, "allowCustomerChecklist", "Checklists");
    const { id } = await params;
    const template = await prisma.checklistTemplate.findFirst({
      where: { id, companyId: context.companyId },
      include: {
        sections: {
          orderBy: { sortOrder: "asc" },
          include: { items: { orderBy: { sortOrder: "asc" } } }
        },
        services: { select: { id: true, name: true } },
        _count: { select: { instances: true } }
      }
    });
    if (!template) throw new ApiError(404, "Template não encontrado");
    return ok({ template });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "checklists:manage");
    await requirePlanFeature(context, "allowCustomerChecklist", "Checklists");
    const { id } = await params;
    await loadOwned(id, context.companyId);
    const body = await request.json();
    const parsed = patchSchema.parse(body);

    const template = await prisma.checklistTemplate.update({
      where: { id },
      data: {
        ...(parsed.name !== undefined ? { name: parsed.name } : {}),
        ...(parsed.description !== undefined ? { description: parsed.description } : {}),
        ...(parsed.status !== undefined ? { status: parsed.status } : {}),
        ...(parsed.estimatedMinutes !== undefined ? { estimatedMinutes: parsed.estimatedMinutes } : {}),
        ...(parsed.sortOrder !== undefined ? { sortOrder: parsed.sortOrder } : {})
      }
    });

    await audit(request, context, {
      action: "checklist_template.update",
      entityType: "checklist_template",
      entityId: id,
      newValues: parsed
    });

    return ok({ template });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "checklists:manage");
    await requirePlanFeature(context, "allowCustomerChecklist", "Checklists");
    const { id } = await params;
    await loadOwned(id, context.companyId);
    const body = await request.json();
    const parsed = structureSchema.parse(body);

    // Replace structure: delete existing sections/items, recreate from payload.
    // Cascade on Section -> TemplateItem makes this atomic via a transaction.
    await prisma.$transaction([
      prisma.checklistSection.deleteMany({ where: { templateId: id, companyId: context.companyId } }),
      ...parsed.sections.map((sec, sIdx) =>
        prisma.checklistSection.create({
          data: {
            companyId: context.companyId,
            templateId: id,
            name: sec.name,
            sortOrder: sec.sortOrder ?? sIdx,
            items: {
              create: sec.items.map((it, iIdx) => ({
                companyId: context.companyId,
                description: it.description,
                itemType: it.itemType,
                isRequired: it.isRequired,
                helpText: it.helpText ?? null,
                sortOrder: it.sortOrder ?? iIdx
              }))
            }
          }
        })
      )
    ]);

    const fresh = await prisma.checklistTemplate.findUnique({
      where: { id },
      include: {
        sections: {
          orderBy: { sortOrder: "asc" },
          include: { items: { orderBy: { sortOrder: "asc" } } }
        }
      }
    });

    await audit(request, context, {
      action: "checklist_template.structure_update",
      entityType: "checklist_template",
      entityId: id,
      newValues: { sectionCount: parsed.sections.length }
    });

    return ok({ template: fresh });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "checklists:manage");
    await requirePlanFeature(context, "allowCustomerChecklist", "Checklists");
    const { id } = await params;
    const template = await loadOwned(id, context.companyId);

    const usage = await prisma.checklist.count({ where: { templateId: id } });
    if (usage > 0) {
      // Soft delete: mark as PAUSED to preserve foreign keys in checklists
      await prisma.checklistTemplate.update({ where: { id }, data: { status: "PAUSED" } });
      await audit(request, context, {
        action: "checklist_template.archive",
        entityType: "checklist_template",
        entityId: id,
        oldValues: { status: template.status }
      });
      return ok({ ok: true, archived: true });
    }

    await prisma.checklistTemplate.delete({ where: { id } });
    await audit(request, context, {
      action: "checklist_template.delete",
      entityType: "checklist_template",
      entityId: id
    });
    return ok({ ok: true, archived: false });
  } catch (error) {
    return handleApiError(error);
  }
}
