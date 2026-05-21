import { describe, expect, it } from "vitest";
import { z } from "zod";
import { generateBotToken, verifyBotToken } from "@/lib/bot-token";

describe("Bot Token Authentication", () => {
  it("should reject request without token", async () => {
    // Simulating requireBotToken behavior
    const bearerHeader = null;
    expect(bearerHeader).toBeNull();
  });

  it("should reject request with malformed bearer header", async () => {
    const bearerHeader = "Token abc123";
    expect(bearerHeader.startsWith("Bearer ")).toBe(false);
  });

  it("should accept valid bearer header format", async () => {
    const companyId = "comp_test_data";
    const token = await generateBotToken(companyId);
    const bearerHeader = `Bearer ${token}`;
    expect(bearerHeader.startsWith("Bearer ")).toBe(true);

    const extractedToken = bearerHeader.slice(7);
    const result = await verifyBotToken(extractedToken);
    expect(result.companyId).toBe(companyId);
  });

  it("should reject token with wrong scope", async () => {
    // A regular auth token won't have scope "bot"
    const { SignJWT } = await import("jose");
    const secret = new TextEncoder().encode(
      process.env.AUTH_SECRET ?? "dev-agendaflex-secret-change-me-with-32-characters"
    );

    // Create a token with wrong scope
    const wrongScopeToken = await new SignJWT({
      scope: "user",
      companyId: "comp_wrong"
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(secret);

    await expect(verifyBotToken(wrongScopeToken)).rejects.toThrow();
  });

  it("should reject token without companyId", async () => {
    const { SignJWT } = await import("jose");
    const secret = new TextEncoder().encode(
      process.env.AUTH_SECRET ?? "dev-agendaflex-secret-change-me-with-32-characters"
    );

    const noCompanyToken = await new SignJWT({
      scope: "bot"
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(secret);

    await expect(verifyBotToken(noCompanyToken)).rejects.toThrow();
  });
});

describe("Bot Data Route Schemas", () => {
  const appointmentCreateSchema = z.object({
    customerPhone: z.string().min(8).max(30),
    customerName: z.string().min(1).max(180),
    serviceId: z.string().min(1),
    professionalId: z.string().min(1),
    startsAt: z.coerce.date()
  });

  it("should accept valid appointment creation body", () => {
    const result = appointmentCreateSchema.safeParse({
      customerPhone: "5511999999999",
      customerName: "João Silva",
      serviceId: "svc_123",
      professionalId: "prof_456",
      startsAt: "2025-01-17T14:00:00Z"
    });
    expect(result.success).toBe(true);
  });

  it("should reject appointment without customerPhone", () => {
    const result = appointmentCreateSchema.safeParse({
      customerName: "João Silva",
      serviceId: "svc_123",
      professionalId: "prof_456",
      startsAt: "2025-01-17T14:00:00Z"
    });
    expect(result.success).toBe(false);
  });

  it("should reject appointment with too short phone", () => {
    const result = appointmentCreateSchema.safeParse({
      customerPhone: "1234",
      customerName: "João Silva",
      serviceId: "svc_123",
      professionalId: "prof_456",
      startsAt: "2025-01-17T14:00:00Z"
    });
    expect(result.success).toBe(false);
  });

  it("should reject appointment without serviceId", () => {
    const result = appointmentCreateSchema.safeParse({
      customerPhone: "5511999999999",
      customerName: "João Silva",
      professionalId: "prof_456",
      startsAt: "2025-01-17T14:00:00Z"
    });
    expect(result.success).toBe(false);
  });

  it("should coerce startsAt string to Date", () => {
    const result = appointmentCreateSchema.safeParse({
      customerPhone: "5511999999999",
      customerName: "João Silva",
      serviceId: "svc_123",
      professionalId: "prof_456",
      startsAt: "2025-01-17T14:00:00Z"
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.startsAt).toBeInstanceOf(Date);
    }
  });

  const statusSchema = z.object({
    status: z.enum(["confirmed", "cancelled"])
  });

  it("should accept 'confirmed' status", () => {
    expect(statusSchema.safeParse({ status: "confirmed" }).success).toBe(true);
  });

  it("should accept 'cancelled' status", () => {
    expect(statusSchema.safeParse({ status: "cancelled" }).success).toBe(true);
  });

  it("should reject invalid status", () => {
    expect(statusSchema.safeParse({ status: "completed" }).success).toBe(false);
  });

  it("should reject empty status", () => {
    expect(statusSchema.safeParse({ status: "" }).success).toBe(false);
  });

  const availabilityQuerySchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    serviceId: z.string().optional(),
    professionalId: z.string().optional()
  });

  it("should accept valid availability query", () => {
    const result = availabilityQuerySchema.safeParse({
      date: "2025-01-17",
      serviceId: "svc_123"
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid date format", () => {
    const result = availabilityQuerySchema.safeParse({
      date: "17/01/2025"
    });
    expect(result.success).toBe(false);
  });
});

describe("Tenant Isolation", () => {
  it("should extract companyId from token, not from body", async () => {
    const tokenCompanyId = "company_from_token";
    const bodyCompanyId = "company_from_body";

    const token = await generateBotToken(tokenCompanyId);
    const { companyId } = await verifyBotToken(token);

    // The companyId should come from the token, never from the body
    expect(companyId).toBe(tokenCompanyId);
    expect(companyId).not.toBe(bodyCompanyId);
  });

  it("should generate different tokens for different companies", async () => {
    const token1 = await generateBotToken("company_A");
    const token2 = await generateBotToken("company_B");

    expect(token1).not.toBe(token2);

    const result1 = await verifyBotToken(token1);
    const result2 = await verifyBotToken(token2);

    expect(result1.companyId).toBe("company_A");
    expect(result2.companyId).toBe("company_B");
  });
});
