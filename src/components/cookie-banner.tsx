"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ShieldCheck, ChevronDown } from "lucide-react";

const CONSENT_KEY = "marcaiflex_cookie_consent";
const CONSENT_TTL = 365; // dias
// Evento interno para manter todas as instâncias do hook em sincronia sem reload
// (o banner e a página de agendamento usam o hook separadamente).
const CONSENT_EVENT = "marcaiflex:cookie-consent";

type Consent = "accepted" | "declined" | null;

function getConsent(): Consent {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${CONSENT_KEY}=`));
  return (match?.split("=")[1] as Consent) ?? null;
}

function setConsent(value: "accepted" | "declined") {
  const expires = new Date();
  expires.setDate(expires.getDate() + CONSENT_TTL);
  document.cookie = `${CONSENT_KEY}=${value}; path=/; expires=${expires.toUTCString()}; SameSite=Lax`;
}

export function useCookieConsent() {
  const [consent, setConsentState] = useState<Consent>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setConsentState(getConsent());
    setReady(true);

    function onChange(event: Event) {
      setConsentState((event as CustomEvent<Consent>).detail);
    }
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);

  const apply = (value: "accepted" | "declined") => {
    setConsent(value);
    setConsentState(value);
    window.dispatchEvent(new CustomEvent<Consent>(CONSENT_EVENT, { detail: value }));
  };

  const accept = () => {
    apply("accepted");
    // Registra o consentimento (fire and forget — nunca bloqueia a navegação)
    fetch("/api/public/cookie-consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        consent: "accepted",
        timestamp: new Date().toISOString(),
        url: window.location.pathname
      })
    }).catch(() => {});
  };

  const decline = () => apply("declined");

  return { consent, ready, accept, decline };
}

const INTERNAL_PREFIXES = [
  "/dashboard",
  "/agenda",
  "/clientes",
  "/profissionais",
  "/servicos",
  "/financeiro",
  "/relatorios",
  "/configuracoes",
  "/usuarios",
  "/link-agenda",
  "/logs",
  "/notas-fiscais",
  "/ajuda",
  "/master"
];

export function CookieBanner() {
  const pathname = usePathname();
  const { consent, ready, accept, decline } = useCookieConsent();
  const [showDetails, setShowDetails] = useState(false);

  // Não mostrar dentro do painel autenticado (já consentiram no cadastro).
  const isInternalRoute = INTERNAL_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  // Não renderizar até hidratar (evita flash) nem em rotas internas.
  if (!ready || consent !== null || isInternalRoute) return null;

  return (
    <>
      {/* Overlay semi-transparente */}
      <div className="cb-overlay" />

      {/* Banner */}
      <div className="cb" role="dialog" aria-modal="true" aria-label="Aviso de cookies e privacidade">
        <div className="cb__head">
          <span className="cb__ico">
            <ShieldCheck size={20} />
          </span>
          <div>
            <h3>Cookies e Privacidade</h3>
            <p>
              Usamos cookies estritamente necessários para autenticação e funcionamento do site. Ao continuar, você
              concorda com nossa{" "}
              <a href="/privacidade" target="_blank" rel="noreferrer">
                Política de Privacidade
              </a>{" "}
              e nossos{" "}
              <a href="/termos" target="_blank" rel="noreferrer">
                Termos de Uso
              </a>
              .
            </p>
          </div>
        </div>

        {/* Detalhes expandíveis */}
        <button className="cb__details-toggle" type="button" onClick={() => setShowDetails((v) => !v)}>
          Ver detalhes dos cookies
          <ChevronDown
            size={14}
            style={{ transform: showDetails ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
          />
        </button>

        {showDetails && (
          <div className="cb__details">
            <table className="cb__table">
              <thead>
                <tr>
                  <th>Cookie</th>
                  <th>Finalidade</th>
                  <th>Duração</th>
                  <th>Tipo</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>marcaiflex_token</code></td>
                  <td>Autenticação da sessão (HttpOnly, seguro)</td>
                  <td>8h / 30 dias</td>
                  <td><span className="cb__tag cb__tag--required">Necessário</span></td>
                </tr>
                <tr>
                  <td><code>marcaiflex_cookie_consent</code></td>
                  <td>Registra sua preferência de cookies</td>
                  <td>365 dias</td>
                  <td><span className="cb__tag cb__tag--required">Necessário</span></td>
                </tr>
              </tbody>
            </table>
            <p className="cb__note">
              ✅ Não utilizamos cookies de rastreamento, publicidade ou analytics de terceiros.
            </p>
          </div>
        )}

        {/* Botões de ação */}
        <div className="cb__actions">
          <button className="cb__btn cb__btn--decline" type="button" onClick={decline}>
            Recusar não essenciais
          </button>
          <button className="cb__btn cb__btn--accept" type="button" onClick={accept}>
            <ShieldCheck size={15} />
            Aceitar e continuar
          </button>
        </div>
      </div>
    </>
  );
}
