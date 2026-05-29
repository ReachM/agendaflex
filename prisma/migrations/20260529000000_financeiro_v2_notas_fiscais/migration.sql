-- ═══════════════════════════════════════════════════
-- Financeiro v2 + Notas Fiscais (mock + prep NFE.io)
-- Adiciona: FinancialCategory, FinancialAccount, CompanyInvoiceConfig
-- Estende: FinancialRecord (categoryId, accountId, flowType, dueDate)
--          InvoiceRequest (issAmount, serviceCode, errorMessage, nfeioInvoiceId)
-- ═══════════════════════════════════════════════════

-- CreateEnum
CREATE TYPE "FinancialFlowType" AS ENUM ('REVENUE', 'COST', 'EXPENSE');

-- CreateEnum
CREATE TYPE "FinancialAccountType" AS ENUM ('CHECKING', 'SAVINGS', 'CASH', 'OTHER');

-- AlterTable
ALTER TABLE "FinancialRecord"
    ADD COLUMN "categoryId" TEXT,
    ADD COLUMN "accountId" TEXT,
    ADD COLUMN "flowType" "FinancialFlowType" NOT NULL DEFAULT 'REVENUE',
    ADD COLUMN "dueDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "InvoiceRequest"
    ADD COLUMN "issAmount" DECIMAL(12,2),
    ADD COLUMN "serviceCode" TEXT,
    ADD COLUMN "errorMessage" TEXT,
    ADD COLUMN "nfeioInvoiceId" TEXT;

-- CreateTable
CREATE TABLE "FinancialCategory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FinancialFlowType" NOT NULL,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialAccount" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FinancialAccountType" NOT NULL DEFAULT 'CHECKING',
    "initialBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyInvoiceConfig" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "municipalRegistration" TEXT,
    "stateRegistration" TEXT,
    "issRate" DECIMAL(5,2),
    "serviceCode" TEXT,
    "taxRegime" TEXT,
    "nfeioApiKey" TEXT,
    "nfeioCompanyId" TEXT,
    "autoEmit" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyInvoiceConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinancialRecord_companyId_flowType_idx" ON "FinancialRecord"("companyId", "flowType");

-- CreateIndex
CREATE INDEX "FinancialRecord_companyId_dueDate_idx" ON "FinancialRecord"("companyId", "dueDate");

-- CreateIndex
CREATE INDEX "FinancialRecord_categoryId_idx" ON "FinancialRecord"("categoryId");

-- CreateIndex
CREATE INDEX "FinancialRecord_accountId_idx" ON "FinancialRecord"("accountId");

-- CreateIndex
CREATE INDEX "FinancialCategory_companyId_idx" ON "FinancialCategory"("companyId");

-- CreateIndex
CREATE INDEX "FinancialCategory_companyId_type_idx" ON "FinancialCategory"("companyId", "type");

-- CreateIndex
CREATE INDEX "FinancialCategory_companyId_isActive_idx" ON "FinancialCategory"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "FinancialAccount_companyId_idx" ON "FinancialAccount"("companyId");

-- CreateIndex
CREATE INDEX "FinancialAccount_companyId_isActive_idx" ON "FinancialAccount"("companyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyInvoiceConfig_companyId_key" ON "CompanyInvoiceConfig"("companyId");

-- AddForeignKey
ALTER TABLE "FinancialRecord" ADD CONSTRAINT "FinancialRecord_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinancialCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialRecord" ADD CONSTRAINT "FinancialRecord_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialCategory" ADD CONSTRAINT "FinancialCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialAccount" ADD CONSTRAINT "FinancialAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyInvoiceConfig" ADD CONSTRAINT "CompanyInvoiceConfig_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
