-- AlterTable
ALTER TABLE "CompanyBotConfig" ADD COLUMN     "botRequestPhone" TEXT,
ADD COLUMN     "botRequestNotes" TEXT,
ADD COLUMN     "botRequestStatus" TEXT,
ADD COLUMN     "botRequestedAt" TIMESTAMP(3),
ADD COLUMN     "botConfiguredAt" TIMESTAMP(3);
