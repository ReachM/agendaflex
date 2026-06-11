-- Arquitetura multi-empresa: o SaaS usa UMA conta/chave NFE.io global
-- (env NFE_IO_API_KEY). A chave por empresa deixa de fazer sentido, então
-- removemos a coluna. O nfeioCompanyId (gerado pela NFE.io) permanece.
ALTER TABLE "CompanyInvoiceConfig" DROP COLUMN IF EXISTS "nfeioApiKey";
