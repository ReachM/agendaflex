/**
 * Helpers do fluxo de checkout (Opção A — redirect). Em arquivo separado para
 * ficar facilmente testável sem precisar montar React/CSS no ambiente de teste.
 *
 * Ver comentário do componente CheckoutModal para o panorama do fluxo (Opção A
 * vs Opção B).
 */

/** Tempo que a tela de transição fica visível antes do redirect. */
export const CHECKOUT_REDIRECT_DELAY_MS = 2000;

/**
 * Agenda o redirect para a URL de autorização do Mercado Pago.
 *
 * - `url`     init_point devolvido pelo backend
 * - `delayMs` quanto tempo segurar a transição (padrão 2000ms)
 * - `go`      callback de navegação. Padrão: `window.location.href = u`.
 *             É injetável para que os testes não precisem mexer em
 *             `window.location` (que é só-leitura em alguns ambientes).
 *
 * Retorna uma função `cancel()` para abortar o redirect se o componente
 * desmontar antes do timer disparar.
 */
export function scheduleCheckoutRedirect(
  url: string,
  delayMs: number = CHECKOUT_REDIRECT_DELAY_MS,
  go: (u: string) => void = (u) => {
    if (typeof window !== "undefined") window.location.href = u;
  }
): () => void {
  const id = setTimeout(() => go(url), delayMs);
  return () => clearTimeout(id);
}
