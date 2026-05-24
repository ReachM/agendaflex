-- Bot Evolution API: configuração por empresa, estado de conversa e idempotência de lembretes.

-- CreateEnum
CREATE TYPE "BotConversationStep" AS ENUM ('IDLE', 'AWAITING_SERVICE', 'AWAITING_DATE', 'AWAITING_SLOT', 'AWAITING_NAME');

-- CreateTable
CREATE TABLE "CompanyBotConfig" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "whatsappInstance" TEXT,
    "allowBooking" BOOLEAN NOT NULL DEFAULT false,
    "faqConfig" JSONB NOT NULL DEFAULT '[]',
    "reminderConfig" JSONB NOT NULL DEFAULT '{}',
    "businessHours" TEXT,
    "cancellationPolicy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyBotConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotConversationState" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "step" "BotConversationStep" NOT NULL DEFAULT 'IDLE',
    "context" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotConversationState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SentReminder" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SentReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyBotConfig_companyId_key" ON "CompanyBotConfig"("companyId");

-- CreateIndex
CREATE INDEX "CompanyBotConfig_companyId_idx" ON "CompanyBotConfig"("companyId");

-- CreateIndex
CREATE INDEX "BotConversationState_companyId_idx" ON "BotConversationState"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "BotConversationState_companyId_phone_key" ON "BotConversationState"("companyId", "phone");

-- CreateIndex
CREATE INDEX "SentReminder_appointmentId_idx" ON "SentReminder"("appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "SentReminder_appointmentId_type_key" ON "SentReminder"("appointmentId", "type");

-- AddForeignKey
ALTER TABLE "CompanyBotConfig" ADD CONSTRAINT "CompanyBotConfig_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotConversationState" ADD CONSTRAINT "BotConversationState_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SentReminder" ADD CONSTRAINT "SentReminder_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
