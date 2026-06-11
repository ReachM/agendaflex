import { NextRequest } from "next/server";
import { ApiError, handleApiError, ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";

// Parser de CSV simples (suporta campos entre aspas com vírgula e aspas escapadas).
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseBrazilDate(value: string): Date | null {
  if (!value) return null;
  // Aceita DD/MM/YYYY e YYYY-MM-DD
  const dmY = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmY) {
    const d = new Date(Number(dmY[3]), Number(dmY[2]) - 1, Number(dmY[1]));
    return isNaN(d.getTime()) ? null : d;
  }
  const iso = value.match(/^\d{4}-\d{2}-\d{2}$/);
  if (iso) {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    // Importar cria clientes → exige permissão de gerenciar (não só visualizar).
    const context = await requireTenant(request, "customers:manage");

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      throw new ApiError(422, "Nenhum arquivo enviado.");
    }

    const text = await (file as Blob).text();
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      throw new ApiError(422, "Arquivo vazio ou sem dados além do cabeçalho.");
    }

    // Remove BOM do início do cabeçalho (arquivos salvos pelo Excel).
    const header = parseCsvLine(lines[0].replace(/^﻿/, "")).map((h) => h.toLowerCase().trim());
    const nameIdx = header.findIndex((h) => h.includes("nome"));
    const phoneIdx = header.findIndex((h) => h.includes("telefone") || h.includes("fone") || h.includes("celular"));
    const emailIdx = header.findIndex((h) => h.includes("e-mail") || h.includes("email"));
    const birthIdx = header.findIndex((h) => h.includes("nascimento") || h.includes("data"));
    const notesIdx = header.findIndex((h) => h.includes("obs") || h.includes("nota"));

    if (nameIdx === -1) {
      throw new ApiError(422, "Coluna 'Nome' não encontrada no arquivo. Use o template como base.");
    }

    const dataLines = lines.slice(1);
    const MAX_IMPORT = 2000;

    if (dataLines.length > MAX_IMPORT) {
      throw new ApiError(422, `Limite de ${MAX_IMPORT} clientes por importação.`);
    }

    let imported = 0;
    let skipped = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    for (let i = 0; i < dataLines.length; i++) {
      const cols = parseCsvLine(dataLines[i]);
      const name = nameIdx >= 0 ? cols[nameIdx]?.trim() : "";
      const phone = phoneIdx >= 0 ? cols[phoneIdx]?.trim() : "";
      const email = emailIdx >= 0 ? cols[emailIdx]?.trim() : "";
      const birth = birthIdx >= 0 ? cols[birthIdx]?.trim() : "";
      const notes = notesIdx >= 0 ? cols[notesIdx]?.trim() : "";

      // Nome é obrigatório
      if (!name) {
        skipped++;
        continue;
      }

      try {
        // Evitar duplicata: cliente ativo com o mesmo telefone já cadastrado.
        if (phone) {
          const existing = await prisma.customer.findFirst({
            where: { companyId: context.companyId, phone, deletedAt: null },
            select: { id: true }
          });
          if (existing) {
            skipped++;
            continue;
          }
        }

        await prisma.customer.create({
          data: {
            companyId: context.companyId,
            name,
            phone: phone || null,
            email: email || null,
            birthDate: parseBrazilDate(birth),
            notes: notes || null,
            status: "active"
          }
        });
        imported++;
      } catch {
        errors++;
        if (errorDetails.length < 5) {
          errorDetails.push(`Linha ${i + 2}: "${name}" — erro ao salvar`);
        }
      }
    }

    return ok({
      imported,
      skipped,
      errors,
      errorDetails,
      message: `${imported} cliente(s) importado(s)${
        skipped > 0 ? `, ${skipped} ignorado(s) (duplicatas ou sem nome)` : ""
      }${errors > 0 ? `, ${errors} com erro` : ""}.`
    });
  } catch (error) {
    return handleApiError(error);
  }
}
