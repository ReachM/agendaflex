import type { AppointmentStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { requirePlanFeature } from "@/lib/security/plan-guard";

const KNOWN_STATUSES = new Set<AppointmentStatus>([
  "SCHEDULED",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW"
]);

function csvEscape(value: string): string {
  if (/[",\n;]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value));
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireTenant(request, "reports:view");
    await requirePlanFeature(context, "allowAdvancedReports", "Relatórios avançados");

    const params = request.nextUrl.searchParams;
    const from = params.get("from") ? new Date(params.get("from") as string) : null;
    const to = params.get("to") ? new Date(params.get("to") as string) : null;
    const statuses = params.getAll("status").filter((s): s is AppointmentStatus =>
      KNOWN_STATUSES.has(s as AppointmentStatus)
    );
    const professionalId = params.get("professionalId");
    const serviceId = params.get("serviceId");

    const appointments = await prisma.appointment.findMany({
      where: {
        companyId: context.companyId,
        ...(from || to
          ? { startAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
          : {}),
        ...(statuses.length > 0 ? { status: { in: statuses } } : {}),
        ...(professionalId ? { professionalId } : {}),
        ...(serviceId
          ? {
              OR: [
                { serviceId },
                { appointmentServices: { some: { serviceId } } }
              ]
            }
          : {})
      },
      select: {
        startAt: true,
        status: true,
        totalValue: true,
        customer: { select: { name: true } },
        professional: { select: { name: true } },
        appointmentServices: { select: { serviceNameSnapshot: true } },
        service: { select: { name: true } }
      },
      orderBy: { startAt: "desc" },
      take: 5000
    });

    const header = ["Data", "Cliente", "Profissional", "Serviços", "Status", "Valor total"];
    const lines = [header.join(",")];

    for (const a of appointments) {
      const services = a.appointmentServices.length > 0
        ? a.appointmentServices.map((s) => s.serviceNameSnapshot).join(" + ")
        : a.service?.name ?? "";

      const row = [
        formatDateTime(a.startAt),
        a.customer?.name ?? "",
        a.professional?.name ?? "",
        services,
        a.status,
        formatMoney(a.totalValue ? Number(a.totalValue) : null)
      ].map(csvEscape);

      lines.push(row.join(","));
    }

    const csv = "﻿" + lines.join("\r\n");
    const filename = `relatorio-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
