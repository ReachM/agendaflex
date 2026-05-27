-- Troca de gateway de pagamento: Mercado Pago -> Asaas.
-- Apenas renomeamos colunas/índices e adicionamos gatewayCustomerId. Nenhum
-- dado é perdido — os IDs gravados pelo MP ficam órfãos (não existem no Asaas),
-- mas as colunas continuam apontando para o mesmo registro lógico até o próximo
-- checkout sobrescrever.

-- CompanySubscription: renomes
ALTER TABLE "CompanySubscription" RENAME COLUMN "mpPreapprovalId" TO "gatewaySubscriptionId";
ALTER TABLE "CompanySubscription" RENAME COLUMN "mpPayerEmail" TO "payerEmail";
ALTER INDEX "CompanySubscription_mpPreapprovalId_key" RENAME TO "CompanySubscription_gatewaySubscriptionId_key";

-- CompanySubscription: nova coluna para guardar o customer id do Asaas
ALTER TABLE "CompanySubscription" ADD COLUMN "gatewayCustomerId" TEXT;

-- PaymentEvent: renomes
ALTER TABLE "PaymentEvent" RENAME COLUMN "mpEventId" TO "gatewayEventId";
ALTER TABLE "PaymentEvent" RENAME COLUMN "mpResourceId" TO "gatewayResourceId";
ALTER INDEX "PaymentEvent_mpEventId_key" RENAME TO "PaymentEvent_gatewayEventId_key";
ALTER INDEX "PaymentEvent_mpResourceId_idx" RENAME TO "PaymentEvent_gatewayResourceId_idx";
