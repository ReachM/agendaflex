import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { resolvePlanFeatures } from "@/lib/security/plan-guard";
import { attachCustomValues } from "@/lib/services/custom-field-values";

type Range = "today" | "week" | "month" | "year";

function rangeBounds(range: Range, now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  if (range === "week") {
    start.setDate(start.getDate() - start.getDay());
  } else if (range === "month") {
    start.setDate(1);
  } else if (range === "year") {
    start.setMonth(0, 1);
  }
  return { start, end };
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireTenant(request);
    const cid = context.companyId;
    const planFeatures = await resolvePlanFeatures(cid);

    const rangeParam = request.nextUrl.searchParams.get("range");
    const range: Range = rangeParam === "today" || rangeParam === "week" || rangeParam === "year"
      ? rangeParam
      : "month";

    const now = new Date();
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay); endOfDay.setDate(endOfDay.getDate() + 1);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const { start: periodStart, end: periodEnd } = rangeBounds(range, now);

    // Compute upcoming birthday window (next 30 days)
    const birthdayWindow = new Date(now);
    birthdayWindow.setDate(birthdayWindow.getDate() + 30);

    const [
      customers,
      newCustomersThisMonth,
      services,
      professionals,
      todayAppointments,
      pendingAppointments,
      confirmedAppointments,
      completedAppointments,
      cancelledAppointments,
      monthlyAppointments,
      periodAppointments,
      nextAppointments,
      todayProfessionals,
      topServices,
      todayFullAppointments,
      // Occupation: total minutes booked vs available within the period
      occupationData,
      // Birthdays this month
      customersWithBirth,
      // VIP via appointments aggregation
      vipCandidates
    ] = await Promise.all([
      prisma.customer.count({ where: { companyId: cid, deletedAt: null } }),
      prisma.customer.count({ where: { companyId: cid, deletedAt: null, createdAt: { gte: startOfMonth } } }),
      prisma.service.count({ where: { companyId: cid, isActive: true } }),
      prisma.professional.count({ where: { companyId: cid, isActive: true } }),
      prisma.appointment.count({ where: { companyId: cid, startAt: { gte: startOfDay, lt: endOfDay } } }),
      prisma.appointment.count({ where: { companyId: cid, status: "SCHEDULED" } }),
      prisma.appointment.count({ where: { companyId: cid, status: "CONFIRMED" } }),
      prisma.appointment.count({ where: { companyId: cid, status: "COMPLETED" } }),
      prisma.appointment.count({ where: { companyId: cid, status: "CANCELLED" } }),
      prisma.appointment.count({ where: { companyId: cid, startAt: { gte: startOfMonth, lt: endOfMonth } } }),
      prisma.appointment.count({ where: { companyId: cid, startAt: { gte: periodStart, lte: periodEnd } } }),
      prisma.appointment.findMany({
        where: {
          companyId: cid,
          startAt: { gte: now },
          status: { notIn: ["CANCELLED", "NO_SHOW"] }
        },
        include: {
          customer: true,
          service: true,
          professional: true,
          appointmentServices: { include: { service: true } }
        },
        orderBy: { startAt: "asc" },
        take: 8
      }),
      prisma.appointment.findMany({
        where: {
          companyId: cid,
          startAt: { gte: startOfDay, lt: endOfDay },
          status: { notIn: ["CANCELLED", "NO_SHOW"] }
        },
        select: { professionalId: true, professional: { select: { name: true } } },
        distinct: ["professionalId"]
      }),
      prisma.appointment.groupBy({
        by: ["serviceId"],
        where: {
          companyId: cid,
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
          serviceId: { not: null }
        },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 5
      }),
      prisma.appointment.findMany({
        where: {
          companyId: cid,
          startAt: { gte: startOfDay, lt: endOfDay }
        },
        include: {
          customer: true,
          service: true,
          professional: true,
          appointmentServices: {
            include: { service: true },
            orderBy: { createdAt: "asc" }
          },
          checklists: {
            select: { id: true, status: true, _count: { select: { items: true } } }
          }
        },
        orderBy: { startAt: "asc" }
      }),
      // Occupation: aggregate appointment minutes in the period
      prisma.appointment.findMany({
        where: {
          companyId: cid,
          startAt: { gte: periodStart, lte: periodEnd },
          status: { notIn: ["CANCELLED", "NO_SHOW"] }
        },
        select: { startAt: true, endAt: true, professionalId: true }
      }),
      // Birthdays — fetch customers with birthDate (filter in memory by month/day)
      prisma.customer.findMany({
        where: { companyId: cid, deletedAt: null, birthDate: { not: null } },
        select: { id: true, name: true, birthDate: true, phone: true },
        take: 200
      }),
      // VIP — top 5 customers by total appointments value
      prisma.appointment.groupBy({
        by: ["customerId"],
        where: { companyId: cid, status: "COMPLETED", totalValue: { not: null } },
        _sum: { totalValue: true },
        _count: { id: true },
        orderBy: { _sum: { totalValue: "desc" } },
        take: 5
      })
    ]);

    // Custom values
    const todayAppointmentsWithValues = await attachCustomValues(cid, "APPOINTMENT", todayFullAppointments);
    const nextAppointmentsWithValues = await attachCustomValues(cid, "APPOINTMENT", nextAppointments);

    // Top services enrichment
    const topServiceIds = topServices.map(s => s.serviceId).filter(Boolean) as string[];
    const serviceNames = topServiceIds.length > 0
      ? await prisma.service.findMany({ where: { id: { in: topServiceIds } }, select: { id: true, name: true } })
      : [];
    const topServicesResult = topServices.map(s => {
      const svc = serviceNames.find(n => n.id === s.serviceId);
      return { serviceId: s.serviceId, serviceName: svc?.name ?? "-", count: s._count.id };
    });

    // Occupation rate — booked minutes / available minutes (professionals × 8h/day × days in period)
    const bookedMinutes = occupationData.reduce((acc, a) => {
      const diff = (new Date(a.endAt).getTime() - new Date(a.startAt).getTime()) / 60000;
      return acc + diff;
    }, 0);
    const daysInPeriod = Math.max(1, Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000)));
    const workingMinutesPerDay = 8 * 60;
    const availableMinutes = Math.max(1, professionals * workingMinutesPerDay * daysInPeriod);
    const occupancyRate = Math.min(100, Math.round((bookedMinutes / availableMinutes) * 100));

    // Birthdays this/next 30 days
    const monthDay = (d: Date) => d.getMonth() * 100 + d.getDate();
    const nowMd = monthDay(now);
    const windowMd = monthDay(birthdayWindow);
    const upcomingBirthdays = customersWithBirth
      .map(c => {
        if (!c.birthDate) return null;
        const md = monthDay(new Date(c.birthDate));
        const inWindow = windowMd >= nowMd
          ? md >= nowMd && md <= windowMd
          : md >= nowMd || md <= windowMd;
        return inWindow ? { id: c.id, name: c.name, birthDate: c.birthDate, phone: c.phone, md } : null;
      })
      .filter((c): c is { id: string; name: string; birthDate: Date; phone: string | null; md: number } => c !== null)
      .sort((a, b) => a.md - b.md)
      .slice(0, 5);

    // VIP enrichment
    const vipIds = vipCandidates.map(v => v.customerId);
    const vipMap = vipIds.length > 0
      ? await prisma.customer.findMany({ where: { id: { in: vipIds } }, select: { id: true, name: true, phone: true } })
      : [];
    const vipCustomers = vipCandidates.map(v => {
      const c = vipMap.find(x => x.id === v.customerId);
      return {
        customerId: v.customerId,
        name: c?.name ?? "—",
        phone: c?.phone ?? null,
        totalSpent: Number(v._sum.totalValue ?? 0),
        visits: v._count.id
      };
    });

    const result: Record<string, unknown> = {
      range,
      period: { from: periodStart.toISOString(), to: periodEnd.toISOString() },
      metrics: {
        customers,
        newCustomersThisMonth,
        services,
        professionals,
        todayAppointments,
        pendingAppointments,
        confirmedAppointments,
        completedAppointments,
        cancelledAppointments,
        monthlyAppointments,
        periodAppointments,
        occupancyRate,
        bookedHours: Math.round(bookedMinutes / 60),
        availableHours: Math.round(availableMinutes / 60)
      },
      nextAppointments: nextAppointmentsWithValues,
      todayAppointmentsList: todayAppointmentsWithValues,
      todayProfessionals: todayProfessionals.map(p => ({
        id: p.professionalId,
        name: p.professional.name
      })),
      topServices: topServicesResult,
      vipCustomers,
      upcomingBirthdays,
      plan: {
        name: planFeatures.planName,
        slug: planFeatures.planSlug,
        maxAppointmentsPerMonth: planFeatures.maxAppointmentsPerMonth,
        usedAppointmentsThisMonth: monthlyAppointments
      }
    };

    if (planFeatures.allowFinancialControl) {
      const [dayRevenue, periodRevenue, monthRevenue, prevMonthRevenue, monthExpense, receivable] = await Promise.all([
        prisma.financialRecord.aggregate({
          where: { companyId: cid, flowType: "REVENUE", paymentStatus: "PAID", paidAt: { gte: startOfDay, lt: endOfDay } },
          _sum: { amount: true }
        }),
        prisma.financialRecord.aggregate({
          where: { companyId: cid, flowType: "REVENUE", paymentStatus: "PAID", paidAt: { gte: periodStart, lte: periodEnd } },
          _sum: { amount: true }
        }),
        prisma.financialRecord.aggregate({
          where: { companyId: cid, flowType: "REVENUE", paymentStatus: "PAID", paidAt: { gte: startOfMonth, lt: endOfMonth } },
          _sum: { amount: true }
        }),
        prisma.financialRecord.aggregate({
          where: { companyId: cid, flowType: "REVENUE", paymentStatus: "PAID", paidAt: { gte: startOfPrevMonth, lt: startOfMonth } },
          _sum: { amount: true }
        }),
        prisma.financialRecord.aggregate({
          where: { companyId: cid, flowType: { in: ["COST", "EXPENSE"] }, paymentStatus: "PAID", paidAt: { gte: startOfMonth, lt: endOfMonth } },
          _sum: { amount: true }
        }),
        prisma.financialRecord.aggregate({
          where: { companyId: cid, flowType: "REVENUE", paymentStatus: "PENDING" },
          _sum: { amount: true },
          _count: { id: true }
        })
      ]);

      const monthRev = Number(monthRevenue._sum.amount ?? 0);
      const prevRev = Number(prevMonthRevenue._sum.amount ?? 0);
      const revDelta = prevRev > 0 ? Number((((monthRev - prevRev) / prevRev) * 100).toFixed(1)) : 0;

      result.financial = {
        dayRevenue: Number(dayRevenue._sum.amount ?? 0),
        periodRevenue: Number(periodRevenue._sum.amount ?? 0),
        monthRevenue: monthRev,
        prevMonthRevenue: prevRev,
        monthDelta: revDelta,
        monthExpense: Number(monthExpense._sum.amount ?? 0),
        monthBalance: monthRev - Number(monthExpense._sum.amount ?? 0),
        receivable: Number(receivable._sum.amount ?? 0),
        receivableCount: receivable._count.id
      };
    }

    if (planFeatures.allowBotIntegration) {
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const [botConversations, botReminders, botAppointments, botEnabled] = await Promise.all([
        prisma.botConversationState.count({ where: { companyId: cid, updatedAt: { gte: last24h } } }),
        prisma.sentReminder.count({ where: { sentAt: { gte: last24h }, appointment: { companyId: cid } } }),
        prisma.appointment.count({ where: { companyId: cid, source: "BOT", createdAt: { gte: last24h } } }),
        prisma.company.findUnique({ where: { id: cid }, select: { botEnabled: true } })
      ]);
      result.bot = {
        enabled: botEnabled?.botEnabled ?? false,
        conversations24h: botConversations,
        reminders24h: botReminders,
        appointments24h: botAppointments
      };
    }

    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
