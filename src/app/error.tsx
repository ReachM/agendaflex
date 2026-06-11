"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log do erro para debugging (em produção poderia enviar para Sentry, etc.)
    console.error("[App Error]", error);
  }, [error]);

  return (
    <div className="error-page">
      <div className="error-page__wrap">

        {/* Logo */}
        <div className="error-page__logo">
          <div className="error-page__mark">MF</div>
          <span>Marcai<strong>Flex</strong></span>
        </div>

        {/* Ícone de erro */}
        <div className="error-page__code error-page__code--warn">!</div>

        {/* Mensagem */}
        <h1 className="error-page__title">Algo deu errado</h1>
        <p className="error-page__desc">
          Ocorreu um erro inesperado. Nossa equipe já foi notificada.<br />
          Tente novamente ou volte para o início.
        </p>

        {/* Código de diagnóstico (só em produção com digest) */}
        {error.digest && (
          <p className="error-page__digest">
            Código: <code>{error.digest}</code>
          </p>
        )}

        {/* Ações */}
        <div className="error-page__actions">
          <button className="btn btn-primary" onClick={reset}>
            Tentar novamente
          </button>
          <Link href="/dashboard" className="btn btn-ghost">
            Voltar ao painel
          </Link>
        </div>

        <p className="error-page__help">
          Se o problema persistir:{" "}
          <a href="mailto:contato@marcaiflex.com.br">contato@marcaiflex.com.br</a>
        </p>

      </div>
    </div>
  );
}
