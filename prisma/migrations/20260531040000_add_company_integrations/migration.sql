-- ═══════════════════════════════════════════════════
-- CompanyIntegration — armazena metadados não-sensíveis das integrações
-- (NFE.io, Stripe, Asaas, etc.). A API key completa NUNCA é persistida —
-- apenas os últimos 4 chars (apiKeyHint) para identificação visual.
-- ═══════════════════════════════════════════════════

-- CreateTable
CREATE TABLE "CompanyIntegration" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL DEFAULT '{}',
    "apiKeyHint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyIntegration_companyId_idx" ON "CompanyIntegration"("companyId");
CREATE UNIQUE INDEX "CompanyIntegration_companyId_type_key" ON "CompanyIntegration"("companyId", "type");

-- AddForeignKey
ALTER TABLE "CompanyIntegration"
    ADD CONSTRAINT "CompanyIntegration_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
