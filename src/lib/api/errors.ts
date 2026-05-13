import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function created<T>(data: T) {
  return ok(data, 201);
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, details: error.details },
      { status: error.status }
    );
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
  ) {
    const typedError = error as { status: number; message?: string; details?: unknown };
    return NextResponse.json(
      { error: typedError.message ?? "Erro na requisição.", details: typedError.details },
      { status: typedError.status }
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Dados inválidos.", details: error.flatten() },
      { status: 422 }
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Registro duplicado para uma restrição única.", details: error.meta },
        { status: 409 }
      );
    }

    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "Registro não encontrado." },
        { status: 404 }
      );
    }
  }

  console.error(error);
  return NextResponse.json(
    { error: "Erro interno do servidor." },
    { status: 500 }
  );
}
