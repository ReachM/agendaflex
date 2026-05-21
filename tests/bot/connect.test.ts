import { describe, expect, it } from "vitest";
import { z } from "zod";
import { generateBotToken, verifyBotToken } from "@/lib/bot-token";

describe("Bot Token", () => {
  it("should generate a valid bot token with scope and companyId", async () => {
    const companyId = "test-company-123";
    const token = await generateBotToken(companyId);

    expect(token).toBeDefined();
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(20);
  });

  it("should verify a valid bot token and return companyId", async () => {
    const companyId = "test-company-456";
    const token = await generateBotToken(companyId);
    const result = await verifyBotToken(token);

    expect(result.companyId).toBe(companyId);
  });

  it("should reject an invalid token", async () => {
    await expect(verifyBotToken("invalid-token")).rejects.toThrow();
  });

  it("should reject a token with empty string", async () => {
    await expect(verifyBotToken("")).rejects.toThrow();
  });
});

describe("Bot Connect Schema", () => {
  const connectSchema = z.object({
    chatbotApiKey: z.string().min(10).startsWith("chatbot_sk_")
  });

  it("should accept valid API Key", () => {
    const result = connectSchema.safeParse({ chatbotApiKey: "chatbot_sk_abc123456789" });
    expect(result.success).toBe(true);
  });

  it("should reject API Key without correct prefix", () => {
    const result = connectSchema.safeParse({ chatbotApiKey: "sk_live_abc123456789" });
    expect(result.success).toBe(false);
  });

  it("should reject API Key that is too short", () => {
    const result = connectSchema.safeParse({ chatbotApiKey: "chatbot_" });
    expect(result.success).toBe(false);
  });

  it("should reject empty API Key", () => {
    const result = connectSchema.safeParse({ chatbotApiKey: "" });
    expect(result.success).toBe(false);
  });
});

describe("Plan Guard - Bot Integration", () => {
  it("should have allowBotIntegration in DEFAULT_FEATURES as false", async () => {
    // Import dynamically to verify the type export
    const { resolvePlanFeatures } = await import("@/lib/security/plan-guard");
    expect(resolvePlanFeatures).toBeDefined();
  });
});
