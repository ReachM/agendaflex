"use client";

import { Lock, ShieldCheck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CHECKOUT_REDIRECT_DELAY_MS, scheduleCheckoutRedirect } from "./checkout-modal.helpers";
import "./checkout-modal.css";

/**
 * ════════════════════════════════════════════════════════════════════
 * Checkout — fluxo REDIRECT para o Mercado Pago
 * ════════════════════════════════════════════════════════════════════
 * POST /api/subscription/checkout cria a assinatura (preapproval) no
 * Mercado Pago e devolve `checkoutUrl` (init_point). Levamos o cliente
 * para essa URL — toda a parte sensível de coleta de pagamento acontece
 * no ambiente do MP. A ativação da assinatura (status ACTIVE) chega
 * pelo WEBHOOK do MP.
 *
 * NENHUM dado de cartão passa pelo nosso domínio.
 */

type CheckoutModalProps = {
  planSlug: string;
  planName: string;
  amount: number;
  /** Fechar/cancelar antes do redirect. */
  onClose: () => void;
  /** Mantido por compatibilidade com chamadores antigos. No fluxo redirect a
   *  confirmação chega via webhook quando o cliente termina o pagamento no
   *  Asaas — este componente não chama onSuccess. */
  onSuccess: () => void;
};

type Status = "preparing" | "redirecting" | "error";

export function CheckoutModal({ planSlug, planName, amount, onClose, onSuccess }: CheckoutModalProps) {
  const [status, setStatus] = useState<Status>("preparing");
  const [error, setError] = useState("");
  const cancelRef = useRef<(() => void) | null>(null);

  // Marca onSuccess como referenciada para o TypeScript não reclamar e para
  // documentar que a prop existe por compat — o ciclo se completa pelo webhook
  // do Mercado Pago.
  void onSuccess;

  useEffect(() => {
    let alive = true;

    (async () => {
      let response: Response;
      try {
        response = await fetch("/api/subscription/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planSlug })
        });
      } catch {
        if (!alive) return;
        setError("Falha de conexão ao iniciar o pagamento.");
        setStatus("error");
        return;
      }
      const data = await response.json().catch(() => ({}));
      if (!alive) return;
      if (!response.ok || !data?.checkoutUrl) {
        setError(data?.error ?? "Não foi possível iniciar o pagamento. Tente novamente.");
        setStatus("error");
        return;
      }
      // Mostra a tela de transição por CHECKOUT_REDIRECT_DELAY_MS antes de
      // jogar o cliente para o Mercado Pago.
      setStatus("redirecting");
      cancelRef.current = scheduleCheckoutRedirect(data.checkoutUrl);
    })();

    return () => {
      alive = false;
      cancelRef.current?.();
    };
  }, [planSlug]);

  const showClose = status !== "redirecting";

  return (
    <div className="checkout-overlay" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
      <div className="checkout-modal">
        <div className="checkout-modal__head">
          <div>
            <h2 id="checkout-title">Assinar {planName}</h2>
            <p>
              {amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} por mês · cobrança recorrente
            </p>
          </div>
          {showClose && (
            <button type="button" className="checkout-modal__close" aria-label="Fechar" onClick={onClose}>
              <X size={20} />
            </button>
          )}
        </div>

        {status === "error" ? (
          <>
            <div className="error-box">{error}</div>
            <button type="button" className="button secondary" onClick={onClose} style={{ marginTop: 12, width: "100%" }}>
              Fechar
            </button>
          </>
        ) : (
          <div className="checkout-redirect">
            <div className="checkout-redirect__icon" aria-hidden="true">
              <Lock size={26} />
            </div>
            <h3>Redirecionando para o Mercado Pago...</h3>
            <p>
              Você será levado ao ambiente seguro do Mercado Pago para concluir o pagamento.
              Após pagar, sua assinatura é ativada automaticamente.
            </p>
            <div
              className="checkout-redirect__bar"
              role="progressbar"
              aria-label="Preparando redirecionamento"
              style={{ ["--checkout-delay" as string]: `${CHECKOUT_REDIRECT_DELAY_MS}ms` }}
            >
              <span />
            </div>
            <div className="checkout-redirect__badge">
              <ShieldCheck size={14} />
              Pagamento 100% seguro pelo Mercado Pago
            </div>
          </div>
        )}

        <p className="checkout-secure muted">
          O MarcaiFlex nunca recebe nem armazena dados do seu cartão.
        </p>
      </div>
    </div>
  );
}
