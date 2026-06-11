import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";

function csvEscape(value: string): string {
  if (/[",\n;]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("pt-BR").format(d);
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireTenant(request, "customers:view");

    const customers = await prisma.customer.findMany({
      where: { companyId: context.companyId, deletedAt: null },
      orderBy: { name: "asc" },
      select: {
        name: true,
        phone: true,
        email: true,
        birthDate: true,
        notes: true,
        createdAt: true
      }
    });

    const header = ["Nome", "Telefone", "E-mail", "Data de nascimento", "Observações", "Criado em"];
    const lines = [header.map(csvEscape).join(",")];

    for (const c of customers) {
      const row = [
        c.name ?? "",
        c.phone ?? "",
        c.email ?? "",
        formatDate(c.birthDate),
        c.notes ?? "",
        formatDate(c.createdAt)
      ].map(csvEscape);
      lines.push(row.join(","));
    }

    const csv = "﻿" + lines.join("\r\n"); // BOM para Excel reconhecer UTF-8
    const filename = `clientes-${new Date().toISOString().slice(0, 10)}.csv`;

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
