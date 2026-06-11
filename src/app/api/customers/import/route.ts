import { NextRequest } from "next/server";
import { ApiError, handleApiError, ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { rateLimit } from "@/lib/security/rate-limit";
import { getRequestIp } from "@/lib/security/request";

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
    // 5 importações por hora por IP — operação cara, evita abuso.
    rateLimit(`customers-import:${getRequestIp(request)}`, 5, 60 * 60 * 1000);
    assertSameOrigin(request);
    // Importar cria clientes → exige permissão de gerenciar (não só visualizar).
    const context = await requireTenant(request, "customers:manage");

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      throw new ApiError(422, "Nenhum arquivo enviado.");
    }

    // Validar tamanho (máx 5MB).
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if ((file as Blob).size > MAX_FILE_SIZE) {
      throw new ApiError(422, "Arquivo muito grande. Máximo permitido: 5MB.");
    }

    // Validar tipo MIME (ou extensão .csv como fallback).
    const fileType = (file as File).type ?? "";
    const fileName = (file as File).name ?? "";
    const isValidType =
      fileType === "text/csv" ||
      fileType === "application/vnd.ms-excel" ||
      fileType === "text/plain" ||
      fileName.toLowerCase().endsWith(".csv");
    if (!isValidType) {
      throw new ApiError(422, "Tipo de arquivo inválido. Apenas arquivos .csv são aceitos.");
    }

    const text = await (file as Blob).text();

    // Rejeitar conteúdo binário (null byte indica arquivo não-CSV).
    if (text.includes("\x00")) {
      throw new ApiError(422, "Arquivo parece estar em formato binário. Use um arquivo .csv de texto.");
    }
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

    // Parsear todas as linhas primeiro (descartar as sem nome).
    const parsed = dataLines
      .map((line, i) => {
        const cols = parseCsvLine(line);
        return {
          lineNum: i + 2,
          name: nameIdx >= 0 ? (cols[nameIdx]?.trim() ?? "") : "",
          phone: phoneIdx >= 0 ? (cols[phoneIdx]?.trim() ?? "") : "",
          email: emailIdx >= 0 ? (cols[emailIdx]?.trim() ?? "") : "",
          birth: birthIdx >= 0 ? (cols[birthIdx]?.trim() ?? "") : "",
          notes: notesIdx >= 0 ? (cols[notesIdx]?.trim() ?? "") : ""
        };
      })
      .filter((r) => r.name.length > 0);

    // Verificar duplicatas em 1 query — buscar todos os telefones existentes de uma vez.
    const phonesToCheck = [...new Set(parsed.map((r) => r.phone).filter(Boolean))];
    const existingPhones = new Set<string>();
    if (phonesToCheck.length > 0) {
      const existing = await prisma.customer.findMany({
        where: {
          companyId: context.companyId,
          phone: { in: phonesToCheck },
          deletedAt: null
        },
        select: { phone: true }
      });
      existing.forEach((c) => {
        if (c.phone) existingPhones.add(c.phone);
      });
    }

    // Separar registros que serão importados dos que serão ignorados.
    const toCreate = parsed.filter((r) => !r.phone || !existingPhones.has(r.phone));
    const skippedDups = parsed.length - toCreate.length;
    const skippedNoName = dataLines.length - parsed.length; // linhas sem nome

    // createMany em batch único.
    let imported = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    if (toCreate.length > 0) {
      try {
        const result = await prisma.customer.createMany({
          data: toCreate.map((r) => ({
            companyId: context.companyId,
            name: r.name,
            phone: r.phone || null,
            email: r.email || null,
            birthDate: parseBrazilDate(r.birth),
            notes: r.notes || null,
            status: "active" as const
          })),
          skipDuplicates: true // segurança extra contra race conditions
        });
        imported = result.count;
        errors = toCreate.length - result.count;
      } catch {
        // Se createMany falhar, tentar individualmente para identificar o problema.
        for (const r of toCreate) {
          try {
            await prisma.customer.create({
              data: {
                companyId: context.companyId,
                name: r.name,
                phone: r.phone || null,
                email: r.email || null,
                birthDate: parseBrazilDate(r.birth),
                notes: r.notes || null,
                status: "active" as const
              }
            });
            imported++;
          } catch {
            errors++;
            if (errorDetails.length < 5) {
              errorDetails.push(`Linha ${r.lineNum}: "${r.name}" — erro ao salvar`);
            }
          }
        }
      }
    }

    const skipped = skippedDups + skippedNoName;

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
