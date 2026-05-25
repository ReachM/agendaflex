"use client";

import { CheckCircle2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import "./checkout-modal.css";

/**
 * Modal de pagamento. O cartão é tokenizado NO CLIENTE pelo Card Payment Brick do
 * Mercado Pago (campos em iframes do MP) — o número/CVV nunca tocam nosso código.
 * Só o card_token resultante é enviado para POST /api/subscription/checkout.
 */

type CheckoutModalProps = {
  planSlug: string;
  planName: string;
  amount: number;
  /** Fechar/cancelar. Em contexto de trial expirado, pode voltar à lista de planos. */
  onClose: () => void;
  /** Chamado após o checkout ser aceito (ativação real vem pelo webhook). */
  onSuccess: () => void;
};

// SDK do MP é carregado via script; tipagem mínima (sem @types oficiais).
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    MercadoPago?: new (publicKey: string, options?: any) => any;
  }
}

const SDK_URL = "https://sdk.mercadopago.com/js/v2";
const BRICK_CONTAINER_ID = "mp-card-brick-container";

function loadMpSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("no window"));
    if (window.MercadoPago) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_URL}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("sdk load error")));
      return;
    }
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("sdk load error"));
    document.body.appendChild(script);
  });
}

type Status = "loading" | "ready" | "submitting" | "success" | "error";

export function CheckoutModal({ planSlug, planName, amount, onClose, onSuccess }: CheckoutModalProps) {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const brickRef = useRef<any>(null);

  useEffect(() => {
    const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
    if (!publicKey) {
      setError("Pagamento indisponível no momento. Tente mais tarde.");
      setStatus("error");
      return;
    }

    let destroyed = false;

    loadMpSdk()
      .then(() => {
        if (destroyed || !window.MercadoPago) return;
        const mp = new window.MercadoPago(publicKey, { locale: "pt-BR" });
        const bricks = mp.bricks();
        return bricks.create("cardPayment", BRICK_CONTAINER_ID, {
          initialization: { amount },
          callbacks: {
            onReady: () => {
              if (!destroyed) setStatus("ready");
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onSubmit: ({ formData }: { formData: any }) => {
              setStatus("submitting");
              setError("");
              return fetch("/api/subscription/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  planSlug,
                  cardTokenId: formData?.token,
                  payerEmail: formData?.payer?.email
                })
              })
                .then(async (response) => {
                  const data = await response.json().catch(() => ({}));
                  if (!response.ok) {
                    setError(data.error ?? "Não foi possível concluir o pagamento.");
                    setStatus("error");
                    return;
                  }
                  // Sucesso do checkout: mostramos a tela de confirmação. A
                  // navegação/atualização real fica no botão "Atualizar agora"
                  // (onSuccess), pois a ativação depende do webhook.
                  setStatus("success");
                })
                .catch(() => {
                  setError("Falha de conexão ao processar o pagamento.");
                  setStatus("error");
                });
            },
            onError: () => {
              if (!destroyed) {
                setError("Não foi possível carregar o formulário de pagamento.");
                setStatus("error");
              }
            }
          }
        });
      })
      .then((controller) => {
        if (controller) brickRef.current = controller;
      })
      .catch(() => {
        if (!destroyed) {
          setError("Não foi possível iniciar o pagamento. Tente novamente.");
          setStatus("error");
        }
      });

    return () => {
      destroyed = true;
      if (brickRef.current?.unmount) {
        try {
          brickRef.current.unmount();
        } catch {
          // brick já desmontado
        }
      }
    };
  }, [amount, planSlug, onSuccess]);

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
          <button type="button" className="checkout-modal__close" aria-label="Fechar" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {status === "success" ? (
          <div className="checkout-success">
            <CheckCircle2 size={40} />
            <h3>Pagamento recebido!</h3>
            <p>
              Estamos confirmando sua assinatura com o Mercado Pago — isso leva alguns instantes. Seu acesso é
              liberado automaticamente assim que a confirmação chega.
            </p>
            <button type="button" className="button primary" onClick={onSuccess}>
              Atualizar agora
            </button>
          </div>
        ) : (
          <>
            {error ? <div className="error-box">{error}</div> : null}
            {(status === "loading" || status === "submitting") && (
              <div className="checkout-loading">
                <div className="loading-spinner" />
                <span>{status === "submitting" ? "Processando pagamento..." : "Carregando pagamento seguro..."}</span>
              </div>
            )}
            {/* Container onde o Brick do MP injeta os campos do cartão (iframes do MP). */}
            <div id={BRICK_CONTAINER_ID} className="checkout-brick" />
            <p className="checkout-secure muted">
              Pagamento processado pelo Mercado Pago. Seus dados de cartão não passam pelo AgendaFlex.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
