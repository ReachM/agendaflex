-- ═══════════════════════════════════════════════════
-- Service Category — categorias de serviço por tenant
-- Adiciona: ServiceCategory
-- Estende: Service.categoryId opcional, Service.sortOrder
-- ═══════════════════════════════════════════════════

-- AlterTable Service
ALTER TABLE "Service"
    ADD COLUMN "categoryId" TEXT,
    ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ServiceCategory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Service_companyId_categoryId_idx" ON "Service"("companyId", "categoryId");

-- CreateIndex
CREATE INDEX "ServiceCategory_companyId_idx" ON "ServiceCategory"("companyId");

-- CreateIndex
CREATE INDEX "ServiceCategory_companyId_isActive_idx" ON "ServiceCategory"("companyId", "isActive");

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCategory" ADD CONSTRAINT "ServiceCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
