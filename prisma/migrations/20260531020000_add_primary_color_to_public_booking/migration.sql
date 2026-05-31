-- ═══════════════════════════════════════════════════
-- Identidade visual no agendamento público
-- Adiciona PublicBookingSettings.primaryColor (cor primária da página pública)
-- ═══════════════════════════════════════════════════

-- AlterTable PublicBookingSettings
ALTER TABLE "PublicBookingSettings"
    ADD COLUMN "primaryColor" TEXT DEFAULT '#0d9488';
