import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { requirePlanFeature } from "@/lib/security/plan-guard";

const patchSchema = z.object({
  isChecked: z.boolean().optional(),
  noteValue: z.string().max(2000).nullish(),
  photoUrl: z.string().url().nullish().or(z.literal(""))
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ checklistId: string; itemId: string }> }
) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "checklists:view");
    await requirePlanFeature(context, "allowCustomerChecklist", "Checklist do atendimento");
    const { checklistId, itemId } = await params;
    const body = patchSchema.parse(await request.json());

    const checklist = await prisma.checklist.findFirst({
      where: { id: checklistId, companyId: context.companyId }
    });
    if (!checklist) throw new ApiError(404, "Checklist não encontrado.");

    const item = await prisma.checklistItem.findFirst({
      where: { id: itemId, checklistId, companyId: context.companyId }
    });
    if (!item) throw new ApiError(404, "Item não encontrado.");

    const updated = await prisma.checklistItem.update({
      where: { id: itemId },
      data: {
        ...(body.isChecked !== undefined ? { isChecked: body.isChecked } : {}),
        ...(body.noteValue !== undefined ? { noteValue: body.noteValue } : {}),
        ...(body.photoUrl !== undefined ? { photoUrl: body.photoUrl || null } : {})
      }
    });

    // Auto-bump checklist status to in_progress on first change
    if (checklist.status === "draft") {
      await prisma.checklist.update({ where: { id: checklistId }, data: { status: "in_progress" } });
    }

    await audit(request, context, {
      action: "checklist_item.update",
      entityType: "checklist_item",
      entityId: itemId,
      oldValues: { isChecked: item.isChecked, noteValue: item.noteValue, photoUrl: item.photoUrl },
      newValues: { isChecked: updated.isChecked, noteValue: updated.noteValue, photoUrl: updated.photoUrl }
    });

    return ok({ item: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
