import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { requirePlanFeature } from "@/lib/security/plan-guard";

const patchSchema = z.object({
  status: z.enum(["draft", "in_progress", "completed", "cancelled"]).optional(),
  title: z.string().max(160).optional(),
  notes: z.string().max(500).nullish()
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ checklistId: string }> }) {
  try {
    const context = await requireTenant(request, "checklists:view");
    await requirePlanFeature(context, "allowCustomerChecklist", "Checklist do atendimento");
    const { checklistId } = await params;
    const checklist = await prisma.checklist.findFirst({
      where: { id: checklistId, companyId: context.companyId },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        template: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } }
      }
    });
    if (!checklist) throw new ApiError(404, "Checklist não encontrado.");
    return ok({ checklist });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ checklistId: string }> }) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "checklists:manage");
    await requirePlanFeature(context, "allowCustomerChecklist", "Checklist do atendimento");
    const { checklistId } = await params;
    const body = patchSchema.parse(await request.json());

    const existing = await prisma.checklist.findFirst({
      where: { id: checklistId, companyId: context.companyId },
      include: { items: { where: { isChecked: false }, select: { id: true, isChecked: true } } }
    });
    if (!existing) throw new ApiError(404, "Checklist não encontrado.");

    const updated = await prisma.checklist.update({
      where: { id: checklistId },
      data: {
        ...(body.status !== undefined ? { status: body.status, completedAt: body.status === "completed" ? new Date() : null } : {}),
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {})
      }
    });

    await audit(request, context, {
      action: "checklist.update",
      entityType: "checklist",
      entityId: checklistId,
      oldValues: { status: existing.status },
      newValues: body
    });

    return ok({ checklist: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ checklistId: string }> }) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "checklists:manage");
    await requirePlanFeature(context, "allowCustomerChecklist", "Checklist do atendimento");
    const { checklistId } = await params;
    const existing = await prisma.checklist.findFirst({
      where: { id: checklistId, companyId: context.companyId }
    });
    if (!existing) throw new ApiError(404, "Checklist não encontrado.");

    await prisma.checklist.delete({ where: { id: checklistId } });

    await audit(request, context, {
      action: "checklist.delete",
      entityType: "checklist",
      entityId: checklistId
    });

    return ok({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
