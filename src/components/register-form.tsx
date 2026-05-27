"use client";

import { ArrowLeft, ArrowRight, Check, ExternalLink, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  buildRegisterBody,
  EMPTY_REGISTER_STATE,
  evaluatePasswordStrength,
  formatCpfCnpj,
  formatPhone,
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

/**
 * Intenção escolhida no passo 4. Em AMBOS os casos a conta nasce em TRIAL (o
 * backend não muda). No caso "paid", após criar a conta abrimos o checkout do MP
 * — o trial serve de fallback enquanto o webhook não confirma o pagamento.
 */
type RegisterIntent = { type: "trial" } | { type: "paid"; plan: PublicPlan };

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
  // Qual opção do passo 4 está submetendo ("trial" ou o slug do plano pago).
  // null = nenhuma. Usado para o spinner por botão e para travar os demais.
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<{ slug: string; name: string; amount: number } | null>(null);

  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);

  const busy = submitting !== null;
  const paidPlans = plans.filter((p) => p.price > 0);
  const strength = evaluatePasswordStrength(state.adminPassword);

  function update<K extends keyof RegisterFormState>(key: K, value: RegisterFormState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
    setStepError("");
    setSubmitError("");
  }

  // Carrega os planos públicos ao chegar no passo 4 (cards dos planos pagos).
  useEffect(() => {
    if (step !== TOTAL_STEPS || plans.length > 0 || plansLoading) return;
    let active = true;
    setPlansLoading(true);
    fetch("/api/plans/public")
      .then((r) => (r.ok ? r.json() : { plans: [] }))
      .then((data) => {
        if (active) setPlans(data.plans ?? []);
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

  // Cria a conta. `intent` decide o que acontece DEPOIS da criação:
  //  - "trial": segue direto para o dashboard no teste grátis.
  //  - "paid":  abre o checkout do MP para o plano escolhido (o trial é o
  //             fallback até o webhook confirmar o pagamento).
  // Em ambos os casos a rota /register cria a assinatura TRIALING — o backend
  // (provisionTenant) não muda.
  async function onSubmit(intent: RegisterIntent) {
    if (busy) return;

    // Defesa: os passos 1–3 já foram validados pelo goNext, mas revalidamos
    // antes de criar a conta. (O passo 4 não exige seleção: a opção é o botão.)
    for (let s = 1; s <= 3; s += 1) {
      const error = validateStep(s, state);
      if (error) {
        setStepError(error);
        setStep(s);
        return;
      }
    }

    setSubmitting(intent.type === "paid" ? intent.plan.slug : "trial");
    setSubmitError("");
    setEmailExists(false);

    let response: Response;
    try {
      response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRegisterBody(state))
      });
    } catch {
      setSubmitting(null);
      setSubmitError("Falha de conexão. Tente novamente.");
      return;
    }

    const data = await response.json().catch(() => ({}));
    setSubmitting(null);

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
    if (intent.type === "paid") {
      setCheckout({ slug: intent.plan.slug, name: intent.plan.name, amount: intent.plan.price });
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
              placeholder="(00) 00000-0000"
              value={state.adminPhone}
              onChange={(e) => update("adminPhone", formatPhone(e.target.value))}
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
            <label htmlFor="document">CNPJ ou CPF *</label>
            <input
              id="document"
              type="text"
              placeholder="000.000.000-00"
              value={state.document}
              onChange={(e) => update("document", formatCpfCnpj(e.target.value))}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="companyPhone">Telefone da empresa (opcional)</label>
            <input
              id="companyPhone"
              type="tel"
              placeholder="(00) 00000-0000"
              value={state.companyPhone}
              onChange={(e) => update("companyPhone", formatPhone(e.target.value))}
            />
          </div>
        </div>
      )}

      {/* ── Passo 4: Planos ────────────────────────── */}
      {step === 4 && (
        <div className="register-body register-plans-step">
          {/* Opção A — Testar grátis (padrão / mais popular). */}
          <div className="register-trial-hero">
            <span className="register-trial-hero__badge">
              <Sparkles size={13} /> Mais popular
            </span>
            <h3>Testar grátis por 7 dias</h3>
            <p>Todas as funcionalidades liberadas. Sem cartão agora.</p>
            <button
              className="button"
              type="button"
              onClick={() => onSubmit({ type: "trial" })}
              disabled={busy}
            >
              {submitting === "trial" ? "Criando conta..." : "Começar teste grátis"}
            </button>
          </div>

          <div className="register-plans-divider">
            <span>ou já escolha um plano</span>
          </div>

          {/* Opção B — Planos pagos (Starter, Pro, Max). */}
          {plansLoading ? (
            <div className="register-plans-loading">
              <div className="loading-spinner" />
            </div>
          ) : paidPlans.length > 0 ? (
            <div className="register-plan-grid">
              {paidPlans.map((plan) => (
                <div key={plan.slug} className="register-plan-card">
                  <div className="register-plan-card__name">{plan.name}</div>
                  <div className="register-plan-card__price">
                    {formatPrice(plan.price)}
                    <span>/mês</span>
                  </div>
                  {plan.description && <p className="register-plan-card__desc">{plan.description}</p>}
                  <ul className="register-plan-card__features">
                    {plan.features.map((f) => (
                      <li key={f}>
                        <Check size={14} /> {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    className="button secondary register-plan-card__cta"
                    type="button"
                    onClick={() => onSubmit({ type: "paid", plan })}
                    disabled={busy}
                  >
                    {submitting === plan.slug ? "Criando conta..." : `Assinar ${plan.name}`}
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {/* Opção C — Comparação completa (seção de planos da landing). */}
          <a className="register-compare-link" href="/#planos" target="_blank" rel="noreferrer">
            Ver comparação completa <ExternalLink size={14} />
          </a>
        </div>
      )}

      {/* ── Navegação ──────────────────────────────── */}
      {/* No passo 4 cada opção tem seu próprio botão de ação (trial/assinar);
          aqui só mantemos o "Voltar". */}
      <div className="register-actions">
        {step > 1 ? (
          <button className="button secondary" type="button" onClick={goBack} disabled={busy}>
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
          <span />
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
