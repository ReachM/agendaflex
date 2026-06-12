import { NextRequest } from "next/server";
import { ApiError, handleApiError, ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { getAvailableSlots } from "@/lib/services/availability";

/**
 * GET /api/public/[slug]/slots?date=YYYY-MM-DD&serviceId=xxx&professionalId=xxx
 * Returns available time slots for a given date, service and professional.
 * No authentication required — this is a public endpoint.
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const url = request.nextUrl;
    const dateStr = url.searchParams.get("date");
    const serviceIdsParam = url.searchParams.get("serviceIds") ?? url.searchParams.get("serviceId") ?? "";
    const serviceIds = serviceIdsParam.split(",").map((s) => s.trim()).filter(Boolean);
    const professionalId = url.searchParams.get("professionalId");

    if (!dateStr || serviceIds.length === 0 || !professionalId) {
      throw new ApiError(422, "Parâmetros obrigatórios: date, serviceIds, professionalId.");
    }

    // Find company
    const company = await prisma.company.findUnique({
      where: { slug },
      select: { id: true, status: true, publicBookingEnabled: true }
    });

    if (!company || company.status !== "ACTIVE" || !company.publicBookingEnabled) {
      throw new ApiError(404, "Página de agendamento não encontrada ou desativada.");
    }

    // Disponibilidade calculada pela lógica única (reutilizada pelo bot também).
    const result = await getAvailableSlots({
      companyId: company.id,
      serviceIds,
      professionalId,
      date: dateStr,
      requireServicePublic: true
    });

    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
