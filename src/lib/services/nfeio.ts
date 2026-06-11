import type { CompanyInvoiceConfig, InvoiceRequest } from "@prisma/client";

// Cliente da NFE.io para um SaaS multi-empresa: UMA conta + UMA API key global
// (env NFE_IO_API_KEY). Cada empresa cliente é cadastrada como uma "company" na
// nossa conta NFE.io; o id retornado fica em CompanyInvoiceConfig.nfeioCompanyId.
// Sem a chave, todas as funções degradam graciosamente (ok:false / UNKNOWN) e a
// UI orienta a emissão manual.

const BASE_URL = process.env.NFE_IO_BASE_URL ?? "https://api.nfe.io/v1";

function getApiKey(): string {
  const key = process.env.NFE_IO_API_KEY;
  if (!key) throw new Error("NFE_IO_API_KEY não configurada.");
  return key;
}

// ─── Tipos da API NFE.io ────────────────────────────────────────────────────

interface NfeioAddress {
  country: string;
  state: string;
  city: string;
  district: string;
  street: string;
  number: string;
  postalCode: string;
}

interface NfeioIssuePayload {
  cityServiceCode: string;
  federalServiceCode?: string;
  description: string;
  servicesAmount: number;
  borrower: {
    federalTaxNumber: string;
    name: string;
    email?: string;
    address: NfeioAddress;
  };
}

// ─── Tipos públicos ─────────────────────────────────────────────────────────

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

// ─── Funções ────────────────────────────────────────────────────────────────

/**
 * Cria uma empresa na conta NFE.io do SaaS.
 * Chamar quando um cliente Pro/Max preenche os dados fiscais pela primeira vez.
 * Retorna o nfeioCompanyId para salvar no banco.
 */
export async function createNfeioCompany(data: {
  cnpj: string;
  legalName: string;
  municipalRegistration?: string;
  email?: string;
}): Promise<{ ok: boolean; nfeioCompanyId?: string; errorMessage?: string }> {
  // Sem API key: retorna graciosamente (modo stub).
  if (!process.env.NFE_IO_API_KEY) {
    return { ok: false, errorMessage: "NFE_IO_API_KEY não configurada." };
  }

  try {
    const res = await fetch(`${BASE_URL}/companies`, {
      method: "POST",
      headers: {
        Authorization: getApiKey(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        federalTaxNumber: data.cnpj.replace(/\D/g, ""),
        name: data.legalName,
        municipalTaxNumber: data.municipalRegistration ?? "",
        email: data.email ?? ""
        // Endereço e demais dados podem ser atualizados depois.
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.status }));
      return { ok: false, errorMessage: `NFE.io: ${err.message ?? err.error ?? res.status}` };
    }

    const json = await res.json();
    return { ok: true, nfeioCompanyId: json.id ?? json.companyId };
  } catch (error) {
    return { ok: false, errorMessage: `Erro ao conectar com NFE.io: ${(error as Error).message}` };
  }
}

/**
 * Emite uma NFS-e para o tomador do serviço.
 */
export async function issueInvoice(input: IssueInvoiceInput): Promise<IssueInvoiceResult> {
  if (!process.env.NFE_IO_API_KEY) {
    return {
      ok: false,
      errorMessage:
        "Integração NFE.io não configurada. Adicione NFE_IO_API_KEY no servidor para emissão automática."
    };
  }

  const { config, request } = input;

  if (!config.nfeioCompanyId) {
    return {
      ok: false,
      errorMessage:
        "Empresa ainda não cadastrada no NFE.io. Salve os dados fiscais completos em Configurações → Notas Fiscais."
    };
  }

  try {
    const payload: NfeioIssuePayload = {
      cityServiceCode: config.serviceCode ?? "17.19",
      description: request.notes ?? "Serviços de beleza e estética",
      servicesAmount: Number(request.amount),
      borrower: {
        federalTaxNumber: (request.documentNumber ?? "").replace(/\D/g, ""),
        name: request.legalName,
        email: request.email ?? undefined,
        address: {
          country: "BRA",
          state: request.state ?? "",
          city: request.city ?? "",
          district: request.neighborhood ?? "",
          street: request.address ?? "",
          number: request.number ?? "S/N",
          postalCode: (request.zipCode ?? "").replace(/\D/g, "")
        }
      }
    };

    const res = await fetch(`${BASE_URL}/companies/${config.nfeioCompanyId}/serviceinvoices`, {
      method: "POST",
      headers: {
        Authorization: getApiKey(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.status }));
      return { ok: false, errorMessage: `NFE.io: ${err.message ?? err.error ?? res.status}` };
    }

    const json = await res.json();
    return {
      ok: true,
      nfeioInvoiceId: json.id,
      invoiceNumber: String(json.number ?? ""),
      fileUrl: json.pdfUrl ?? json.downloadUrl ?? undefined
    };
  } catch (error) {
    return { ok: false, errorMessage: `Erro ao emitir nota: ${(error as Error).message}` };
  }
}

/**
 * Cancela uma NFS-e já emitida.
 */
export async function cancelInvoice(
  nfeioInvoiceId: string,
  nfeioCompanyId: string
): Promise<IssueInvoiceResult> {
  if (!process.env.NFE_IO_API_KEY) {
    return { ok: false, errorMessage: "NFE_IO_API_KEY não configurada." };
  }

  try {
    const res = await fetch(
      `${BASE_URL}/companies/${nfeioCompanyId}/serviceinvoices/${nfeioInvoiceId}`,
      {
        method: "DELETE",
        headers: { Authorization: getApiKey() }
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.status }));
      return { ok: false, errorMessage: `NFE.io cancelamento: ${err.message ?? res.status}` };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, errorMessage: `Erro ao cancelar nota: ${(error as Error).message}` };
  }
}

/**
 * Consulta o status de uma NFS-e.
 */
export async function checkInvoiceStatus(
  nfeioInvoiceId: string,
  nfeioCompanyId: string
): Promise<{ status: "AUTHORIZED" | "PROCESSING" | "ERROR" | "UNKNOWN"; raw?: unknown }> {
  if (!process.env.NFE_IO_API_KEY) {
    return { status: "UNKNOWN" };
  }

  try {
    const res = await fetch(
      `${BASE_URL}/companies/${nfeioCompanyId}/serviceinvoices/${nfeioInvoiceId}`,
      { headers: { Authorization: getApiKey() } }
    );

    if (!res.ok) return { status: "UNKNOWN" };

    const json = await res.json();
    const flowStatus: string = json.flowStatus ?? "";

    if (flowStatus === "Issued" || flowStatus === "AuthorizedWithErrors") {
      return { status: "AUTHORIZED", raw: json };
    }
    if (flowStatus.startsWith("Error") || flowStatus === "Cancelled") {
      return { status: "ERROR", raw: json };
    }
    if (flowStatus === "WaitingDefineRpsNumber" || flowStatus === "WaitingCalculateTaxes") {
      return { status: "PROCESSING", raw: json };
    }

    return { status: "UNKNOWN", raw: json };
  } catch {
    return { status: "UNKNOWN" };
  }
}
