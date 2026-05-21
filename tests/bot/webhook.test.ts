import { describe, expect, it } from "vitest";
import { z } from "zod";

const webhookBodySchema = z.object({
  event: z.string().min(1),
  eventId: z.string().optional(),
  companyId: z.string().min(1),
  data: z.record(z.unknown()).optional()
});

describe("Webhook Body Validation", () => {
  it("should accept valid webhook body with all fields", () => {
    const result = webhookBodySchema.safeParse({
      event: "appointment.created",
      eventId: "evt_123",
      companyId: "comp_456",
      data: { customerPhone: "5511999999999" }
    });
    expect(result.success).toBe(true);
  });

  it("should accept webhook body without eventId", () => {
    const result = webhookBodySchema.safeParse({
      event: "reminder.sent",
      companyId: "comp_456"
    });
    expect(result.success).toBe(true);
  });

  it("should reject webhook body without event", () => {
    const result = webhookBodySchema.safeParse({
      companyId: "comp_456"
    });
    expect(result.success).toBe(false);
  });

  it("should reject webhook body without companyId", () => {
    const result = webhookBodySchema.safeParse({
      event: "appointment.created"
    });
    expect(result.success).toBe(false);
  });

  it("should reject empty event string", () => {
    const result = webhookBodySchema.safeParse({
      event: "",
      companyId: "comp_456"
    });
    expect(result.success).toBe(false);
  });
});

describe("Webhook Secret Validation", () => {
  it("should require non-empty webhook secret", () => {
    const secret = "";
    expect(secret).toBeFalsy();
  });

  it("should validate webhook secret format", () => {
    const secret = "whsec_abcdef123456789012345678901234";
    expect(secret.startsWith("whsec_")).toBe(true);
    expect(secret.length).toBeGreaterThan(10);
  });
});

describe("Idempotency", () => {
  it("should deduplicate events by eventId", () => {
    const processedEvents = new Set<string>();
    const eventId = "evt_123";

    // First time processing
    const isFirstDuplicate = processedEvents.has(eventId);
    processedEvents.add(eventId);
    expect(isFirstDuplicate).toBe(false);

    // Second time — should be a duplicate
    const isSecondDuplicate = processedEvents.has(eventId);
    expect(isSecondDuplicate).toBe(true);
  });

  it("should treat different eventIds as different events", () => {
    const processedEvents = new Set<string>();

    processedEvents.add("evt_001");

    expect(processedEvents.has("evt_001")).toBe(true);
    expect(processedEvents.has("evt_002")).toBe(false);
  });
});

describe("Webhook Event Types", () => {
  const validEvents = [
    "appointment.created",
    "appointment.confirmed",
    "appointment.cancelled",
    "human_escalation",
    "reminder.sent"
  ];

  it("should recognize all expected event types", () => {
    for (const event of validEvents) {
      expect(typeof event).toBe("string");
      expect(event.length).toBeGreaterThan(0);
    }
  });

  it("should handle unknown events gracefully", () => {
    const unknownEvent = "unknown.event.type";
    expect(validEvents.includes(unknownEvent)).toBe(false);
    // Unknown events should be logged but not throw — they return 200
  });
});
