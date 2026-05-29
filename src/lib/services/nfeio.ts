import type { CompanyInvoiceConfig, InvoiceRequest } from "@prisma/client";

// Stub para integração com NFE.io. A chamada real será adicionada quando o SDK
// oficial (@nfe.io/nfe ou equivalente) for instalado. Por enquanto retorna mock
// "não configurado" — a UI orienta o admin a marcar a nota como emitida
// manualmente. Não emitir chamadas externas reais a partir daqui antes de:
//   1) Confirmar SDK instalado.
//   2) Validar variáveis de ambiente seguras (NFEIO_API_BASE_URL etc.).
//   3) Mover o segredo da chave para um vault — hoje fica no banco apenas para
//      simplificar o fluxo de configuração no painel.

export type IssueInvoiceInput = {
  config: CompanyInvoiceConfig;
  request: InvoiceRequest;
};

export type IssueInvoiceResult = {
  ok: boolean;
  nfeioInvoiceId?: string;
  fileUrl?: string;
  invoiceNumber?: string;
  errorMessage?: string;
};

export async function issueInvoice(_input: IssueInvoiceInput): Promise<IssueInvoiceResult> {
  return {
    ok: false,
    errorMessage:
      "Integração NFE.io ainda não está conectada. Marque a nota como emitida manualmente após emitir no portal do seu emissor."
  };
}

export async function cancelInvoice(_nfeioInvoiceId: string, _apiKey: string): Promise<IssueInvoiceResult> {
  return {
    ok: false,
    errorMessage: "Integração NFE.io ainda não está conectada para cancelamento automático."
  };
}

export async function checkInvoiceStatus(
  _nfeioInvoiceId: string,
  _apiKey: string
): Promise<{ status: "AUTHORIZED" | "PROCESSING" | "ERROR" | "UNKNOWN"; raw?: unknown }> {
  return { status: "UNKNOWN" };
}
