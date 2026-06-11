import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Página não encontrada | MarcaiFlex",
  robots: { index: false, follow: false }
};

export default function NotFoundPage() {
  return (
    <div className="error-page">
      <div className="error-page__wrap">

        {/* Logo */}
        <div className="error-page__logo">
          <div className="error-page__mark">MF</div>
          <span>Marcai<strong>Flex</strong></span>
        </div>

        {/* Código de erro */}
        <div className="error-page__code">404</div>

        {/* Mensagem */}
        <h1 className="error-page__title">Página não encontrada</h1>
        <p className="error-page__desc">
          Parece que essa página não existe ou foi movida.<br />
          Verifique o endereço ou volte para o início.
        </p>

        {/* Ações */}
        <div className="error-page__actions">
          <Link href="/" className="btn btn-primary">
            Ir para o início
          </Link>
          <Link href="/dashboard" className="btn btn-ghost">
            Acessar o painel
          </Link>
        </div>

        {/* Link de ajuda */}
        <p className="error-page__help">
          Precisa de ajuda?{" "}
          <a href="mailto:contato@marcaiflex.com.br">contato@marcaiflex.com.br</a>
        </p>

      </div>
    </div>
  );
}
