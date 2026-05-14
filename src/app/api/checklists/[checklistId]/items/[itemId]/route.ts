import { NextRequest } from "next/server";
import { ApiError, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { requirePlanFeature } from "@/lib/security/plan-guard";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ checklistId: string; itemId: string }> }
) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "checklists:manage");
    await requirePlanFeature(context, "allowCustomerChecklist", "Checklist do atendimento");
    const { checklistId, itemId } = await params;
    const body = await request.json();

    // Verify checklist belongs to tenant
    const checklist = await prisma.checklist.findFirst({
      where: { id: checklistId, companyId: context.companyId }
    });
    if (!checklist) throw new ApiError(404, "Checklist não encontrado.");

    // Verify item belongs to checklist
    const item = await prisma.checklistItem.findFirst({
      where: { id: itemId, checklistId, companyId: context.companyId }
    });
    if (!item) throw new ApiError(404, "Item não encontrado.");

    const updated = await prisma.checklistItem.update({
      where: { id: itemId },
      data: {
        isChecked: typeof body.isChecked === "boolean" ? body.isChecked : item.isChecked
      }
    });

    await audit(request, context, {
      action: "checklist_item.toggle",
      entityType: "checklist_item",
      entityId: itemId,
      oldValues: { isChecked: item.isChecked },
      newValues: { isChecked: updated.isChecked }
    });

    return ok({ item: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
