import { NextRequest } from "next/server";
import { created, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { requirePlanFeature } from "@/lib/security/plan-guard";

export async function GET(request: NextRequest) {
  try {
    const context = await requireTenant(request, "checklists:manage");
    await requirePlanFeature(context, "allowCustomerChecklist", "Checklist do atendimento");

    const appointmentId = request.nextUrl.searchParams.get("appointmentId");

    const checklists = await prisma.checklist.findMany({
      where: {
        companyId: context.companyId,
        ...(appointmentId ? { appointmentId } : {})
      },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        appointment: {
          select: {
            id: true, startAt: true, status: true,
            customer: { select: { id: true, name: true } },
            professional: { select: { id: true, name: true } }
          }
        },
        customerCopy: { select: { id: true, publicToken: true, status: true } },
        createdBy: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });

    return ok({ checklists });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "checklists:manage");
    await requirePlanFeature(context, "allowCustomerChecklist", "Checklist do atendimento");
    const body = await request.json();

    const checklist = await prisma.checklist.create({
      data: {
        companyId: context.companyId,
        appointmentId: body.appointmentId,
        title: body.title || "Checklist do atendimento",
        notes: body.notes,
        status: "draft",
        createdByUserId: context.user.id,
        items: {
          create: (body.items ?? []).map((item: any, idx: number) => ({
            companyId: context.companyId,
            description: item.description,
            isChecked: item.isChecked ?? false,
            sortOrder: item.sortOrder ?? idx
          }))
        }
      },
      include: { items: { orderBy: { sortOrder: "asc" } } }
    });

    await audit(request, context, {
      action: "checklist.create",
      entityType: "checklist",
      entityId: checklist.id,
      newValues: { id: checklist.id, appointmentId: body.appointmentId, itemCount: checklist.items.length }
    });

    return created({ checklist });
  } catch (error) {
    return handleApiError(error);
  }
}
