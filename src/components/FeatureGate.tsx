"use client";

import { Construction } from "lucide-react";

interface FeatureGateProps {
  featureKey: string;
  features: Record<string, boolean>;
  children: React.ReactNode;
  /** Nome amigável da funcionalidade, exibido na tela de manutenção. */
  label?: string;
}

/**
 * Envolve o conteúdo de uma página atrás de uma feature flag. Quando a flag
 * `feature.<featureKey>` está explicitamente desativada (false), mostra uma
 * tela de "em manutenção" no lugar do conteúdo. Default é ativo (fail-open).
 */
export function FeatureGate({ featureKey, features, children, label }: FeatureGateProps) {
  const enabled = features[featureKey] !== false;
  if (enabled) return <>{children}</>;

  return (
    <div className="feature-maintenance">
      <div className="feature-maintenance__wrap">
        <div className="feature-maintenance__icon">
          <Construction size={40} strokeWidth={1.5} />
        </div>
        <h2 className="feature-maintenance__title">{label ?? "Funcionalidade"} em manutenção</h2>
        <p className="feature-maintenance__desc">
          Esta funcionalidade está temporariamente indisponível para melhorias.
          <br />
          Voltará em breve. Obrigado pela paciência!
        </p>
        <p className="feature-maintenance__contact">
          Dúvidas? <a href="mailto:contato@marcaiflex.com.br">contato@marcaiflex.com.br</a>
        </p>
      </div>
    </div>
  );
}
