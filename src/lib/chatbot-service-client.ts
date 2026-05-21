/**
 * HTTP client for ChatBot Service.
 * Centralizes all outbound calls to the external service.
 * - Uses CHATBOT_SERVICE_URL from environment
 * - 5-second timeout on all requests
 * - Never throws in a way that would crash the AgendaFlex process
 */

const TIMEOUT_MS = 5_000;

function getBaseUrl(): string {
  return process.env.CHATBOT_SERVICE_URL ?? "http://localhost:3001";
}

type ChatbotResult<T = unknown> = {
  ok: boolean;
  status?: number;
  data?: T;
  error?: string;
};

async function chatbotFetch<T = unknown>(
  path: string,
  options: {
    method: string;
    apiKey: string;
    body?: unknown;
  }
): Promise<ChatbotResult<T>> {
  const url = `${getBaseUrl()}${path}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      method: options.method,
      headers: {
        "x-api-key": options.apiKey,
        "Content-Type": "application/json"
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (response.ok) {
      let data: T | undefined;
      try {
        data = (await response.json()) as T;
      } catch {
        // Some endpoints may return empty body
      }
      return { ok: true, status: response.status, data };
    }

    let errorMessage = `ChatBot Service respondeu com status ${response.status}`;
    try {
      const errorBody = (await response.json()) as { error?: string; message?: string };
      if (errorBody.error || errorBody.message) {
        errorMessage = errorBody.error ?? errorBody.message ?? errorMessage;
      }
    } catch {
      // Body may not be JSON
    }

    return { ok: false, status: response.status, error: errorMessage };
  } catch (err) {
    const message =
      err instanceof Error && err.name === "AbortError"
        ? "Timeout ao conectar com o ChatBot Service."
        : "Erro ao conectar com o ChatBot Service.";

    console.error(`[ChatBotClient] ${options.method} ${path} failed:`, err);
    return { ok: false, error: message };
  }
}

/**
 * Register a new tenant in the ChatBot Service.
 */
export async function registerTenant(
  apiKey: string,
  body: {
    name: string;
    webhookUrl: string;
    config: Record<string, unknown>;
  }
): Promise<ChatbotResult> {
  return chatbotFetch("/api/tenants", {
    method: "POST",
    apiKey,
    body
  });
}

/**
 * Update tenant configuration in the ChatBot Service.
 */
export async function updateTenantConfig(
  apiKey: string,
  companyId: string,
  body: Record<string, unknown>
): Promise<ChatbotResult> {
  return chatbotFetch(`/api/tenants/${companyId}`, {
    method: "PATCH",
    apiKey,
    body
  });
}

/**
 * Delete/deregister a tenant from the ChatBot Service.
 */
export async function deleteTenant(
  apiKey: string,
  companyId: string
): Promise<ChatbotResult> {
  return chatbotFetch(`/api/tenants/${companyId}`, {
    method: "DELETE",
    apiKey
  });
}
