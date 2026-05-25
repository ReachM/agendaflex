-- AlterTable
ALTER TABLE "CompanySubscription" ADD COLUMN     "currentPeriodEnd" TIMESTAMP(3),
ADD COLUMN     "lastPaymentId" TEXT,
ADD COLUMN     "lastPaymentStatus" TEXT,
ADD COLUMN     "mpPayerEmail" TEXT,
ADD COLUMN     "mpPreapprovalId" TEXT,
ADD COLUMN     "pastDueSince" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "mpEventId" TEXT NOT NULL,
    "mpResourceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "rawType" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_mpEventId_key" ON "PaymentEvent"("mpEventId");

-- CreateIndex
CREATE INDEX "PaymentEvent_subscriptionId_idx" ON "PaymentEvent"("subscriptionId");

-- CreateIndex
CREATE INDEX "PaymentEvent_mpResourceId_idx" ON "PaymentEvent"("mpResourceId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanySubscription_mpPreapprovalId_key" ON "CompanySubscription"("mpPreapprovalId");

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "CompanySubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

