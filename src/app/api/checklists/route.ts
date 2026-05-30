import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, created, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { requirePlanFeature } from "@/lib/security/plan-guard";

const createSchema = z.object({
  appointmentId: z.string().min(1),
  templateId: z.string().nullish(),
  title: z.string().max(160).nullish(),
  notes: z.string().max(500).nullish(),
  items: z.array(z.object({
    description: z.string().min(1).max(200),
    itemType: z.enum(["CHECKBOX", "NOTE", "PHOTO"]).default("CHECKBOX"),
    isChecked: z.boolean().default(false),
    sortOrder: z.coerce.number().int().min(0).default(0)
  })).optional()
});

export async function GET(request: NextRequest) {
  try {
    const context = await requireTenant(request, "checklists:view");
    await requirePlanFeature(context, "allowCustomerChecklist", "Checklist do atendimento");

    const appointmentId = request.nextUrl.searchParams.get("appointmentId") ?? undefined;

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
        template: { select: { id: true, name: true, status: true } },
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
    const parsed = createSchema.parse(await request.json());

    // Verify appointment belongs to tenant
    const appointment = await prisma.appointment.findFirst({
      where: { id: parsed.appointmentId, companyId: context.companyId },
      select: { id: true, service: { select: { name: true } } }
    });
    if (!appointment) throw new ApiError(404, "Atendimento não encontrado.");

    // If templateId provided, expand sections+items into checklist items
    let itemsToCreate: { description: string; itemType: "CHECKBOX" | "NOTE" | "PHOTO"; sortOrder: number; templateItemId: string | null }[] = [];
    let titleFromTemplate: string | null = null;

    if (parsed.templateId) {
      const template = await prisma.checklistTemplate.findFirst({
        where: { id: parsed.templateId, companyId: context.companyId },
        include: {
          sections: {
            orderBy: { sortOrder: "asc" },
            include: { items: { orderBy: { sortOrder: "asc" } } }
          }
        }
      });
      if (!template) throw new ApiError(404, "Template não encontrado.");
      titleFromTemplate = template.name;

      let order = 0;
      for (const section of template.sections) {
        for (const item of section.items) {
          itemsToCreate.push({
            description: `${section.name}: ${item.description}`,
            itemType: item.itemType,
            sortOrder: order++,
            templateItemId: item.id
          });
        }
      }
    } else if (parsed.items) {
      itemsToCreate = parsed.items.map((it, idx) => ({
        description: it.description,
        itemType: it.itemType,
        sortOrder: it.sortOrder ?? idx,
        templateItemId: null
      }));
    }

    const checklist = await prisma.checklist.create({
      data: {
        companyId: context.companyId,
        appointmentId: parsed.appointmentId,
        templateId: parsed.templateId ?? null,
        title: parsed.title ?? titleFromTemplate ?? `Checklist · ${appointment.service?.name ?? "atendimento"}`,
        notes: parsed.notes ?? null,
        status: "in_progress",
        createdByUserId: context.user.id,
        items: {
          create: itemsToCreate.map(it => ({
            companyId: context.companyId,
            description: it.description,
            itemType: it.itemType,
            sortOrder: it.sortOrder,
            templateItemId: it.templateItemId
          }))
        }
      },
      include: { items: { orderBy: { sortOrder: "asc" } }, template: { select: { id: true, name: true } } }
    });

    await audit(request, context, {
      action: "checklist.create",
      entityType: "checklist",
      entityId: checklist.id,
      newValues: {
        id: checklist.id,
        appointmentId: parsed.appointmentId,
        templateId: parsed.templateId,
        itemCount: checklist.items.length
      }
    });

    return created({ checklist });
  } catch (error) {
    return handleApiError(error);
  }
}
