import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";

type SearchResult = {
  type: "customer" | "service" | "appointment";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
};

const PER_GROUP = 5;

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit"
});

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

export async function GET(request: NextRequest) {
  try {
    const context = await requireTenant(request);
    const q = (request.nextUrl.searchParams.get("q") ?? "").trim();

    if (q.length < 2) {
      return ok({ results: [] });
    }

    const [customers, services, appointments] = await Promise.all([
      prisma.customer.findMany({
        where: {
          companyId: context.companyId,
          deletedAt: null,
          name: { contains: q, mode: "insensitive" }
        },
        select: { id: true, name: true, phone: true },
        take: PER_GROUP,
        orderBy: { name: "asc" }
      }),
      prisma.service.findMany({
        where: {
          companyId: context.companyId,
          isActive: true,
          name: { contains: q, mode: "insensitive" }
        },
        select: { id: true, name: true, basePrice: true },
        take: PER_GROUP,
        orderBy: { name: "asc" }
      }),
      prisma.appointment.findMany({
        where: {
          companyId: context.companyId,
          customer: { name: { contains: q, mode: "insensitive" } }
        },
        select: {
          id: true,
          startAt: true,
          customer: { select: { name: true } },
          service: { select: { name: true } }
        },
        take: PER_GROUP,
        orderBy: { startAt: "desc" }
      })
    ]);

    const results: SearchResult[] = [
      ...customers.map((c) => ({
        type: "customer" as const,
        id: c.id,
        title: c.name,
        subtitle: c.phone ?? undefined,
        href: `/clientes?id=${c.id}`
      })),
      ...services.map((s) => ({
        type: "service" as const,
        id: s.id,
        title: s.name,
        subtitle: s.basePrice ? moneyFormatter.format(Number(s.basePrice)) : undefined,
        href: `/servicos?id=${s.id}`
      })),
      ...appointments.map((a) => ({
        type: "appointment" as const,
        id: a.id,
        title: a.customer?.name ?? "Agendamento",
        subtitle: `${dateFormatter.format(a.startAt)}${a.service?.name ? ` · ${a.service.name}` : ""}`,
        href: `/agenda?id=${a.id}`
      }))
    ];

    return ok({ results });
  } catch (error) {
    return handleApiError(error);
  }
}
