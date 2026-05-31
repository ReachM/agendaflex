-- ═══════════════════════════════════════════════════
-- SystemFlag — feature flags globais da plataforma
-- Gerenciadas pelo Super Admin em /master/feature-flags
-- ═══════════════════════════════════════════════════

-- CreateTable
CREATE TABLE "SystemFlag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "SystemFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SystemFlag_key_key" ON "SystemFlag"("key");

-- Seed inicial de flags (idempotente via ON CONFLICT)
INSERT INTO "SystemFlag" ("id", "key", "value", "description", "updatedAt") VALUES
    ('sysflag_maintenance_mode',      'maintenance_mode',      false, 'Coloca a plataforma em modo de manutenção',                CURRENT_TIMESTAMP),
    ('sysflag_new_onboarding_flow',   'new_onboarding_flow',   false, 'Ativa o novo fluxo de onboarding para novos tenants',      CURRENT_TIMESTAMP),
    ('sysflag_whatsapp_bot_global',   'whatsapp_bot_global',   true,  'Habilita integração WhatsApp globalmente',                 CURRENT_TIMESTAMP),
    ('sysflag_invoice_module',        'invoice_module',        true,  'Módulo de notas fiscais ativo',                            CURRENT_TIMESTAMP),
    ('sysflag_advanced_reports_beta', 'advanced_reports_beta', false, 'Relatórios avançados em beta',                             CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
