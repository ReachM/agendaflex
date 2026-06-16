import { ok } from "@/lib/api/errors";

/**
 * Webhook GLOBAL — não é mais usado para receber mensagens.
 *
 * Com a WuzAPI cada empresa tem o seu próprio webhook (configurado em
 * createInstance) apontando para /api/webhooks/whatsapp/{companyId}. Este
 * endpoint é mantido apenas como placeholder para eventuais eventos globais
 * futuros: responde 200 sem processar nada.
 */
export async function POST() {
  return ok({ received: true });
}
