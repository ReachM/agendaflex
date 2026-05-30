import { NextRequest } from "next/server";
import { ApiError, created, handleApiError } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { requirePlanFeature } from "@/lib/security/plan-guard";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "checklists:manage");
    await requirePlanFeature(context, "allowCustomerChecklist", "Checklists");
    const { id } = await params;

    const source = await prisma.checklistTemplate.findFirst({
      where: { id, companyId: context.companyId },
      include: {
        sections: {
          orderBy: { sortOrder: "asc" },
          include: { items: { orderBy: { sortOrder: "asc" } } }
        }
      }
    });
    if (!source) throw new ApiError(404, "Template não encontrado");

    const copy = await prisma.checklistTemplate.create({
      data: {
        companyId: context.companyId,
        name: `${source.name} (cópia)`,
        description: source.description,
        status: "DRAFT",
        estimatedMinutes: source.estimatedMinutes,
        sortOrder: source.sortOrder,
        sections: {
          create: source.sections.map((sec, sIdx) => ({
            companyId: context.companyId,
            name: sec.name,
            sortOrder: sIdx,
            items: {
              create: sec.items.map((it, iIdx) => ({
                companyId: context.companyId,
                description: it.description,
                itemType: it.itemType,
                isRequired: it.isRequired,
                helpText: it.helpText,
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
      action: "checklist_template.duplicate",
      entityType: "checklist_template",
      entityId: copy.id,
      newValues: { sourceId: source.id, copyId: copy.id }
    });

    return created({ template: copy });
  } catch (error) {
    return handleApiError(error);
  }
}
