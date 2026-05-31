-- ═══════════════════════════════════════════════════
-- Professional ↔ Service link + Professional time-off
-- Estende Professional com avatarUrl
-- ═══════════════════════════════════════════════════

-- AlterTable Professional
ALTER TABLE "Professional"
    ADD COLUMN "avatarUrl" TEXT;

-- CreateTable
CREATE TABLE "ProfessionalService" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfessionalService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfessionalTimeOff" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfessionalTimeOff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalService_professionalId_serviceId_key" ON "ProfessionalService"("professionalId", "serviceId");

-- CreateIndex
CREATE INDEX "ProfessionalService_companyId_idx" ON "ProfessionalService"("companyId");

-- CreateIndex
CREATE INDEX "ProfessionalService_serviceId_idx" ON "ProfessionalService"("serviceId");

-- CreateIndex
CREATE INDEX "ProfessionalTimeOff_companyId_idx" ON "ProfessionalTimeOff"("companyId");

-- CreateIndex
CREATE INDEX "ProfessionalTimeOff_professionalId_startAt_endAt_idx" ON "ProfessionalTimeOff"("professionalId", "startAt", "endAt");

-- AddForeignKey
ALTER TABLE "ProfessionalService" ADD CONSTRAINT "ProfessionalService_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalService" ADD CONSTRAINT "ProfessionalService_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalService" ADD CONSTRAINT "ProfessionalService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalTimeOff" ADD CONSTRAINT "ProfessionalTimeOff_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalTimeOff" ADD CONSTRAINT "ProfessionalTimeOff_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE CASCADE ON UPDATE CASCADE;
