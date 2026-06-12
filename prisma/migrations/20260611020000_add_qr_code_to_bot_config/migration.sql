-- AlterTable
ALTER TABLE "CompanyBotConfig" ADD COLUMN     "qrCodeBase64" TEXT,
ADD COLUMN     "qrCodeExpiresAt" TIMESTAMP(3),
ADD COLUMN     "connectionStatus" TEXT NOT NULL DEFAULT 'disconnected';
