-- ═══════════════════════════════════════════════════
-- Checklists v2 — Templates reutilizáveis
-- Adiciona: ChecklistTemplate, ChecklistSection, ChecklistTemplateItem
-- Estende: Service.checklistTemplateId, Checklist.templateId,
--          ChecklistItem.{templateItemId, itemType, noteValue, photoUrl}
--          Checklist.completedAt
-- ═══════════════════════════════════════════════════

-- CreateEnum
CREATE TYPE "ChecklistTemplateStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "ChecklistItemType" AS ENUM ('CHECKBOX', 'NOTE', 'PHOTO');

-- AlterTable Service
ALTER TABLE "Service"
    ADD COLUMN "checklistTemplateId" TEXT;

-- AlterTable Checklist
ALTER TABLE "Checklist"
    ADD COLUMN "templateId" TEXT,
    ADD COLUMN "completedAt" TIMESTAMP(3);

-- AlterTable ChecklistItem
ALTER TABLE "ChecklistItem"
    ADD COLUMN "templateItemId" TEXT,
    ADD COLUMN "itemType" "ChecklistItemType" NOT NULL DEFAULT 'CHECKBOX',
    ADD COLUMN "noteValue" TEXT,
    ADD COLUMN "photoUrl" TEXT;

-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ChecklistTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "estimatedMinutes" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistSection" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistTemplateItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "itemType" "ChecklistItemType" NOT NULL DEFAULT 'CHECKBOX',
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "helpText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Service_checklistTemplateId_idx" ON "Service"("checklistTemplateId");

-- CreateIndex
CREATE INDEX "Checklist_templateId_idx" ON "Checklist"("templateId");

-- CreateIndex
CREATE INDEX "ChecklistItem_templateItemId_idx" ON "ChecklistItem"("templateItemId");

-- CreateIndex
CREATE INDEX "ChecklistTemplate_companyId_idx" ON "ChecklistTemplate"("companyId");

-- CreateIndex
CREATE INDEX "ChecklistTemplate_companyId_status_idx" ON "ChecklistTemplate"("companyId", "status");

-- CreateIndex
CREATE INDEX "ChecklistSection_companyId_idx" ON "ChecklistSection"("companyId");

-- CreateIndex
CREATE INDEX "ChecklistSection_templateId_idx" ON "ChecklistSection"("templateId");

-- CreateIndex
CREATE INDEX "ChecklistTemplateItem_companyId_idx" ON "ChecklistTemplateItem"("companyId");

-- CreateIndex
CREATE INDEX "ChecklistTemplateItem_sectionId_idx" ON "ChecklistTemplateItem"("sectionId");

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_checklistTemplateId_fkey" FOREIGN KEY ("checklistTemplateId") REFERENCES "ChecklistTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checklist" ADD CONSTRAINT "Checklist_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_templateItemId_fkey" FOREIGN KEY ("templateItemId") REFERENCES "ChecklistTemplateItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTemplate" ADD CONSTRAINT "ChecklistTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistSection" ADD CONSTRAINT "ChecklistSection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistSection" ADD CONSTRAINT "ChecklistSection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTemplateItem" ADD CONSTRAINT "ChecklistTemplateItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTemplateItem" ADD CONSTRAINT "ChecklistTemplateItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ChecklistSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
