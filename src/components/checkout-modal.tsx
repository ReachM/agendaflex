"use client";

import { Lock, ShieldCheck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CHECKOUT_REDIRECT_DELAY_MS, scheduleCheckoutRedirect } from "./checkout-modal.helpers";
import "./checkout-modal.css";

/**
 * ════════════════════════════════════════════════════════════════════
 * Checkout — Opção A (REDIRECT) para o Mercado Pago Assinaturas
 * ════════════════════════════════════════════════════════════════════
 * O MP Assinaturas (preapproval) suporta dois fluxos:
 *
 * • Opção A — REDIRECT (esta implementação):
 *   POST /api/subscription/checkout cria o preapproval e devolve o
 *   `init_point` (URL). O cliente é redirecionado pra esse link, digita
 *   o cartão no ambiente do MP, autoriza, e volta via `back_url`. A
 *   ativação (status ACTIVE) chega pelo WEBHOOK.
 *   Vantagem: NENHUM dado de cartão passa pelo nosso domínio.
 *
 * • Opção B — TRANSPARENTE (não usada aqui):
 *   Tokeniza o cartão no front (cardPayment Brick), envia `card_token_id`
 *   ao backend e o preapproval é criado já como "authorized". Sem
 *   redirect — o cliente fica no MarcaiFlex.
 *
 * Trocar A → B no futuro NÃO exige mudar a forma do backend: bastaria
 * voltar a aceitar `cardTokenId` no body do POST /api/subscription/checkout
 * e repassar pro `createSubscription` (campo opcional do payload do MP).
 */

type CheckoutModalProps = {
  planSlug: string;
  planName: string;
  amount: number;
  /** Fechar/cancelar antes do redirect. */
  onClose: () => void;
  /** Mantido por compatibilidade com chamadores antigos (cardPayment Brick).
   *  No fluxo redirect a confirmação chega via webhook quando o cliente volta
   *  do MP — não chamamos onSuccess. */
  onSuccess: () => void;
};

type Status = "preparing" | "redirecting" | "error";

export function CheckoutModal({ planSlug, planName, amount, onClose, onSuccess }: CheckoutModalProps) {
  const [status, setStatus] = useState<Status>("preparing");
  const [error, setError] = useState("");
  const cancelRef = useRef<(() => void) | null>(null);

  // Marca onSuccess como referenciada para o TypeScript não reclamar e para
  // documentar que a prop existe por compat — o ciclo se completa pelo webhook.
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
      // jogar o cliente para o MP.
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
              Você será levado ao ambiente seguro do Mercado Pago para autorizar sua assinatura.
              Após confirmar, voltará automaticamente para o MarcaiFlex.
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
