import { NextRequest } from "next/server";
import { created, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { attachCustomValues, saveCustomFieldValues } from "@/lib/services/custom-field-values";
import { listQuerySchema, serviceCreateSchema } from "@/lib/validation/schemas";

export async function GET(request: NextRequest) {
  try {
    const context = await requireTenant(request, "services:view");
    const query = listQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const categoryParam = request.nextUrl.searchParams.get("category");

    const services = await prisma.service.findMany({
      where: {
        companyId: context.companyId,
        ...(query.status ? { isActive: query.status === "active" } : {}),
        ...(categoryParam && categoryParam !== "all" && categoryParam !== "uncategorized"
          ? { categoryId: categoryParam }
          : categoryParam === "uncategorized"
          ? { categoryId: null }
          : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                { description: { contains: query.search, mode: "insensitive" } }
              ]
            }
          : {})
      },
      include: {
        category: { select: { id: true, name: true, color: true } },
        checklistTemplate: { select: { id: true, name: true, status: true } }
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      take: 200
    });

    const serviceIds = services.map(s => s.id);
    const counts = serviceIds.length > 0
      ? await prisma.appointmentService.groupBy({
          by: ["serviceId"],
          where: { companyId: context.companyId, serviceId: { in: serviceIds } },
          _count: { id: true },
          _sum: { totalPrice: true }
        })
      : [];
    const countMap = new Map(counts.map(c => [c.serviceId, { count: c._count.id, totalRevenue: Number(c._sum.totalPrice ?? 0) }]));

    const enriched = services.map(s => ({
      ...s,
      basePrice: s.basePrice !== null ? Number(s.basePrice) : null,
      stats: countMap.get(s.id) ?? { count: 0, totalRevenue: 0 }
    }));

    const [categories, totalServices, activeServices] = await Promise.all([
      prisma.serviceCategory.findMany({
        where: { companyId: context.companyId, isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
      }),
      prisma.service.count({ where: { companyId: context.companyId } }),
      prisma.service.count({ where: { companyId: context.companyId, isActive: true } })
    ]);

    const allServiceCounts = await prisma.appointmentService.groupBy({
      by: ["serviceId"],
      where: { companyId: context.companyId },
      _count: { id: true },
      _sum: { totalPrice: true }
    });
    const totalAppointmentServices = allServiceCounts.reduce((acc, c) => acc + c._count.id, 0);
    const totalRevenue = allServiceCounts.reduce((acc, c) => acc + Number(c._sum.totalPrice ?? 0), 0);
    const avgTicket = totalAppointmentServices > 0 ? Number((totalRevenue / totalAppointmentServices).toFixed(2)) : 0;

    let topService: { id: string; name: string; count: number } | null = null;
    if (allServiceCounts.length > 0) {
      const top = [...allServiceCounts].sort((a, b) => b._count.id - a._count.id)[0];
      const svc = await prisma.service.findUnique({ where: { id: top.serviceId }, select: { id: true, name: true } });
      if (svc) topService = { id: svc.id, name: svc.name, count: top._count.id };
    }

    return ok({
      services: await attachCustomValues(context.companyId, "SERVICE", enriched),
      categories,
      metrics: {
        totalServices,
        activeServices,
        inactiveServices: totalServices - activeServices,
        topService,
        avgTicket,
        totalAppointmentServices
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "services:manage");
    const body = serviceCreateSchema.parse(await request.json());

    if (body.categoryId) {
      const cat = await prisma.serviceCategory.findFirst({ where: { id: body.categoryId, companyId: context.companyId } });
      if (!cat) {
        throw new Error("Categoria inválida");
      }
    }
    if (body.checklistTemplateId) {
      const tpl = await prisma.checklistTemplate.findFirst({ where: { id: body.checklistTemplateId, companyId: context.companyId } });
      if (!tpl) throw new Error("Template de checklist inválido");
    }

    const service = await prisma.service.create({
      data: {
        companyId: context.companyId,
        name: body.name,
        description: body.description,
        basePrice: body.basePrice,
        durationMinutes: body.durationMinutes,
        isActive: body.isActive,
        isPublic: body.isPublic,
        categoryId: body.categoryId || null,
        checklistTemplateId: body.checklistTemplateId || null,
        sortOrder: body.sortOrder
      }
    });

    await saveCustomFieldValues({
      companyId: context.companyId,
      entityType: "SERVICE",
      entityId: service.id,
      values: body.customValues
    });

    await audit(request, context, {
      action: "service.create",
      entityType: "service",
      entityId: service.id,
      newValues: { ...service, customValues: body.customValues ?? {} }
    });

    const [withValues] = await attachCustomValues(context.companyId, "SERVICE", [service]);
    return created({ service: withValues });
  } catch (error) {
    return handleApiError(error);
  }
}
