"use client";

import { ArrowLeft, ArrowRight, Check, Sparkles, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  buildRegisterBody,
  EMPTY_REGISTER_STATE,
  evaluatePasswordStrength,
  SEGMENTS,
  validateStep,
  type RegisterFormState
} from "@/lib/registration";
import { CheckoutModal } from "@/components/checkout-modal";

type PublicPlan = {
  name: string;
  slug: string;
  description: string | null;
  price: number;
  features: string[];
};

const STEP_TITLES = ["Sua conta", "Seu segmento", "Sua empresa", "Seu plano"];
const TOTAL_STEPS = STEP_TITLES.length;

function formatPrice(price: number): string {
  if (!Number.isFinite(price) || price <= 0) return "Grátis";
  return price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function RegisterForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [state, setState] = useState<RegisterFormState>(EMPTY_REGISTER_STATE);
  const [stepError, setStepError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [emailExists, setEmailExists] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkout, setCheckout] = useState<{ slug: string; name: string; amount: number } | null>(null);

  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);

  const strength = evaluatePasswordStrength(state.adminPassword);

  function update<K extends keyof RegisterFormState>(key: K, value: RegisterFormState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
    setStepError("");
    setSubmitError("");
  }

  // Carrega os planos públicos ao chegar no passo 4.
  useEffect(() => {
    if (step !== TOTAL_STEPS || plans.length > 0 || plansLoading) return;
    let active = true;
    setPlansLoading(true);
    fetch("/api/plans/public")
      .then((r) => (r.ok ? r.json() : { plans: [] }))
      .then((data) => {
        if (!active) return;
        setPlans(data.plans ?? []);
        // Pré-seleciona o plano de maior valor (Max), liberado no trial.
        if (!state.planSlug && data.plans?.length) {
          update("planSlug", data.plans[data.plans.length - 1].slug);
        }
      })
      .catch(() => active && setPlans([]))
      .finally(() => active && setPlansLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function goNext() {
    const error = validateStep(step, state);
    if (error) {
      setStepError(error);
      return;
    }
    setStepError("");
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  }

  function goBack() {
    setStepError("");
    setSubmitError("");
    setStep((s) => Math.max(1, s - 1));
  }

  async function onSubmit() {
    const error = validateStep(TOTAL_STEPS, state);
    if (error) {
      setStepError(error);
      return;
    }
    setLoading(true);
    setSubmitError("");
    setEmailExists(false);

    // A conta sempre nasce em TRIAL (a rota /register cria a assinatura TRIALING).
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildRegisterBody(state))
    });

    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      if (response.status === 409) {
        // E-mail já cadastrado: volta ao passo 1 com link para login.
        setEmailExists(true);
        setStep(1);
        setStepError("");
        return;
      }
      setSubmitError(data.error ?? "Não foi possível criar a conta. Tente novamente.");
      return;
    }

    // O cookie de sessão é setado pela API (Set-Cookie) — o usuário já está logado.
    // Se escolheu um plano PAGO, abrimos o checkout para assinar (a ativação real
    // virá pelo webhook). Se for grátis / só testar, segue direto no trial.
    const selectedPlan = plans.find((p) => p.slug === state.planSlug);
    if (selectedPlan && selectedPlan.price > 0) {
      setCheckout({ slug: selectedPlan.slug, name: selectedPlan.name, amount: selectedPlan.price });
      return;
    }

    // TODO: futuramente direcionar para um onboarding de configuração da agenda.
    router.push(data.redirectTo ?? "/dashboard");
    router.refresh();
  }

  function onSegmentKeyDown(event: React.KeyboardEvent, value: RegisterFormState["segment"]) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      update("segment", value);
    }
  }

  // Conta já criada (trial). Plano pago escolhido -> abrir checkout. O usuário
  // pode "pagar depois" e seguir no teste gratuito.
  if (checkout) {
    return (
      <CheckoutModal
        planSlug={checkout.slug}
        planName={checkout.name}
        amount={checkout.amount}
        onClose={() => {
          router.push("/dashboard");
          router.refresh();
        }}
        onSuccess={() => {
          router.push("/dashboard");
          router.refresh();
        }}
      />
    );
  }

  return (
    <div className="register-card">
      <div className="register-head">
        <div className="register-steps" aria-label={`Passo ${step} de ${TOTAL_STEPS}`}>
          {STEP_TITLES.map((title, index) => {
            const n = index + 1;
            const status = n < step ? "done" : n === step ? "current" : "todo";
            return (
              <div className={`register-step register-step--${status}`} key={title}>
                <span className="register-step__dot">{n < step ? <Check size={14} /> : n}</span>
                <span className="register-step__label">{title}</span>
              </div>
            );
          })}
        </div>
        <h2>Criar conta no MarcaiFlex</h2>
        <p className="muted">Teste grátis por 7 dias. Sem cartão de crédito.</p>
      </div>

      {emailExists ? (
        <div className="error-box">
          Este e-mail já está cadastrado.{" "}
          <Link href="/login" className="register-inline-link">
            Entrar na minha conta
          </Link>
        </div>
      ) : null}
      {stepError ? <div className="error-box">{stepError}</div> : null}
      {submitError ? <div className="error-box">{submitError}</div> : null}

      {/* ── Passo 1: Conta ─────────────────────────── */}
      {step === 1 && (
        <div className="register-body grid">
          <div className="field">
            <label htmlFor="adminName">Seu nome</label>
            <input
              id="adminName"
              type="text"
              autoComplete="name"
              value={state.adminName}
              onChange={(e) => update("adminName", e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="adminEmail">E-mail</label>
            <input
              id="adminEmail"
              type="email"
              autoComplete="email"
              value={state.adminEmail}
              onChange={(e) => update("adminEmail", e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="adminPhone">Telefone (opcional)</label>
            <input
              id="adminPhone"
              type="tel"
              autoComplete="tel"
              value={state.adminPhone}
              onChange={(e) => update("adminPhone", e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="adminPassword">Senha</label>
            <input
              id="adminPassword"
              type="password"
              autoComplete="new-password"
              value={state.adminPassword}
              onChange={(e) => update("adminPassword", e.target.value)}
              aria-describedby="password-strength"
              required
            />
            {state.adminPassword && (
              <div id="password-strength" className={`password-meter password-meter--${strength.score}`}>
                <div className="password-meter__bar">
                  <span style={{ width: `${(strength.score / 4) * 100}%` }} />
                </div>
                <small>{strength.label}</small>
              </div>
            )}
          </div>
          <div className="field">
            <label htmlFor="adminPasswordConfirm">Confirmar senha</label>
            <input
              id="adminPasswordConfirm"
              type="password"
              autoComplete="new-password"
              value={state.adminPasswordConfirm}
              onChange={(e) => update("adminPasswordConfirm", e.target.value)}
              required
            />
          </div>
        </div>
      )}

      {/* ── Passo 2: Segmento ──────────────────────── */}
      {step === 2 && (
        <div className="register-body">
          <div className="segment-grid" role="radiogroup" aria-label="Segmento do negócio">
            {SEGMENTS.map((seg) => {
              const selected = state.segment === seg.value;
              return (
                <div
                  key={seg.value}
                  role="radio"
                  aria-checked={selected}
                  tabIndex={0}
                  className={`segment-card ${selected ? "segment-card--selected" : ""}`}
                  onClick={() => update("segment", seg.value)}
                  onKeyDown={(e) => onSegmentKeyDown(e, seg.value)}
                >
                  <strong>{seg.label}</strong>
                  <span>{seg.description}</span>
                  {selected && <Check className="segment-card__check" size={18} />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Passo 3: Empresa ───────────────────────── */}
      {step === 3 && (
        <div className="register-body grid">
          <div className="field">
            <label htmlFor="companyName">Nome da empresa</label>
            <input
              id="companyName"
              type="text"
              autoComplete="organization"
              value={state.companyName}
              onChange={(e) => update("companyName", e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="document">CNPJ ou CPF (opcional)</label>
            <input
              id="document"
              type="text"
              value={state.document}
              onChange={(e) => update("document", e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="companyPhone">Telefone da empresa (opcional)</label>
            <input
              id="companyPhone"
              type="tel"
              value={state.companyPhone}
              onChange={(e) => update("companyPhone", e.target.value)}
            />
          </div>
        </div>
      )}

      {/* ── Passo 4: Planos ────────────────────────── */}
      {step === 4 && (
        <div className="register-body">
          <div className="trial-callout">
            <Sparkles size={18} />
            <span>
              Comece com <strong>7 dias grátis</strong>. Durante o teste, <strong>todos os recursos
              ficam liberados</strong> — escolha o plano que pretende manter depois.
            </span>
          </div>
          {plansLoading ? (
            <div className="register-plans-loading">
              <div className="loading-spinner" />
            </div>
          ) : (
            <div className="register-plan-grid" role="radiogroup" aria-label="Plano">
              {plans.map((plan) => {
                const selected = state.planSlug === plan.slug;
                return (
                  <div
                    key={plan.slug}
                    role="radio"
                    aria-checked={selected}
                    tabIndex={0}
                    className={`register-plan-card ${selected ? "register-plan-card--selected" : ""}`}
                    onClick={() => update("planSlug", plan.slug)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        update("planSlug", plan.slug);
                      }
                    }}
                  >
                    <div className="register-plan-card__name">{plan.name}</div>
                    <div className="register-plan-card__price">
                      {formatPrice(plan.price)}
                      {formatPrice(plan.price) !== "Grátis" && <span>/mês após o teste</span>}
                    </div>
                    {plan.description && <p className="register-plan-card__desc">{plan.description}</p>}
                    <ul className="register-plan-card__features">
                      {plan.features.map((f) => (
                        <li key={f}>
                          <Check size={14} /> {f}
                        </li>
                      ))}
                    </ul>
                    {selected && <span className="register-plan-card__badge">Selecionado</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Navegação ──────────────────────────────── */}
      <div className="register-actions">
        {step > 1 ? (
          <button className="button secondary" type="button" onClick={goBack} disabled={loading}>
            <ArrowLeft size={18} /> Voltar
          </button>
        ) : (
          <span />
        )}

        {step < TOTAL_STEPS ? (
          <button className="button" type="button" onClick={goNext}>
            Continuar <ArrowRight size={18} />
          </button>
        ) : (
          <button className="button" type="button" onClick={onSubmit} disabled={loading}>
            <UserPlus size={18} />
            {loading ? "Criando conta..." : "Criar conta e começar teste grátis"}
          </button>
        )}
      </div>

      <p className="register-foot muted">
        Já tem uma conta?{" "}
        <Link href="/login" className="register-inline-link">
          Entrar
        </Link>
      </p>
    </div>
  );
}
