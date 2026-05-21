-- Add ChatBot Service integration fields to Company.
ALTER TABLE "Company"
ADD COLUMN "botEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "botApiKey" TEXT,
ADD COLUMN "botWebhookSecret" TEXT,
ADD COLUMN "botRegisteredAt" TIMESTAMP(3),
ADD COLUMN "botConfig" JSONB;

CREATE UNIQUE INDEX "Company_botApiKey_key" ON "Company"("botApiKey");

-- Webhook idempotency table for ChatBot Service events.
CREATE TABLE "BotWebhookEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BotWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BotWebhookEvent_companyId_eventId_key" ON "BotWebhookEvent"("companyId", "eventId");
CREATE INDEX "BotWebhookEvent_companyId_idx" ON "BotWebhookEvent"("companyId");
CREATE INDEX "BotWebhookEvent_createdAt_idx" ON "BotWebhookEvent"("createdAt");
