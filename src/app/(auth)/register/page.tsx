"use client";

import { AlertCircle, ArrowLeft, ArrowRight, Check, FileText, Lock, Mail, MessageCircle, Store, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, KeyboardEvent, useState } from "react";
import { AuthButton } from "@/components/auth/AuthButton";
import { AuthInput } from "@/components/auth/AuthInput";
import { BrandPanel } from "@/components/auth/BrandPanel";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { StepIndicator } from "@/components/auth/StepIndicator";
import {
  buildRegisterBody,
  EMPTY_REGISTER_STATE,
  evaluatePasswordStrength,
  formatCpfCnpj,
  formatPhone,
  isValidEmail,
  SEGMENTS,
  type RegisterFormState
} from "@/lib/registration";
import type { BusinessSegment } from "@prisma/client";
import "./register.css";

const STEPS = [{ label: "Sua conta" }, { label: "Seu salão" }];
type TeamSize = "solo" | "2-5" | "6-15" | "16+";

const TEAM_OPTIONS: { value: TeamSize; label: string }[] = [
  { value: "solo", label: "Só eu" },
  { value: "2-5", label: "2–5" },
  { value: "6-15", label: "6–15" },
  { value: "16+", label: "16+" }
];

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [state, setState] = useState<RegisterFormState>(EMPTY_REGISTER_STATE);
  // Campos visuais que não persistem mas dão contexto à UX:
  const [teamSize, setTeamSize] = useState<TeamSize>("solo");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [stepError, setStepError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(false);

  function update<K extends keyof RegisterFormState>(key: K, value: RegisterFormState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
    setStepError("");
    setSubmitError("");
  }

  function validateStep1(): string | null {
    if (state.adminName.trim().length < 2) return "Informe seu nome completo.";
    if (!isValidEmail(state.adminEmail)) return "Informe um e-mail válido.";
    if (!evaluatePasswordStrength(state.adminPassword).acceptable) {
      return "A senha precisa ter ao menos 8 caracteres, com letras e números.";
    }
    return null;
  }

  function validateStep2(): string | null {
    if (state.companyName.trim().length < 2) return "Informe o nome do estabelecimento.";
    const docDigits = state.document.replace(/\D/g, "");
    if (docDigits.length !== 11 && docDigits.length !== 14) {
      return "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.";
    }
    if (state.companyPhone.replace(/\D/g, "").length < 10) {
      return "Informe o WhatsApp do salão.";
    }
    if (!state.segment) return "Escolha o tipo de negócio.";
    if (!acceptTerms) return "Você precisa aceitar os Termos e a Política de Privacidade.";
    return null;
  }

  function goNext() {
    const error = validateStep1();
    if (error) {
      setStepError(error);
      return;
    }
    setStepError("");
    setStep(2);
  }

  function goBack() {
    setStepError("");
    setSubmitError("");
    setStep(1);
  }

  function onSegmentKeyDown(event: KeyboardEvent, value: BusinessSegment) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      update("segment", value);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const error = validateStep2();
    if (error) {
      setStepError(error);
      return;
    }

    setLoading(true);
    setSubmitError("");

    let response: Response;
    try {
      response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRegisterBody(state))
      });
    } catch {
      setLoading(false);
      setSubmitError("Falha de conexão. Tente novamente.");
      return;
    }

    const data = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      if (response.status === 409) {
        setStep(1);
        setSubmitError("Este e-mail já está cadastrado. Tente entrar na sua conta.");
        return;
      }
      setSubmitError(data.error ?? "Não foi possível criar a conta. Tente novamente.");
      return;
    }

    router.push(data.redirectTo ?? "/dashboard?welcome=true");
    router.refresh();
  }

  // teamSize não é enviado ao backend hoje (não existe coluna). Mantém o
  // controle só para UX e para futuras decisões de onboarding.
  void teamSize;

  return (
    <main className="auth-wrap">
      <BrandPanel variant="register" />

      <section className="auth-form-panel">
        <div className="auth-form-panel__top">
          <span>Já tem conta?</span>
          <Link href="/login">Entrar</Link>
        </div>

        <form className="auth-form-panel__body" onSubmit={onSubmit} noValidate>
          <StepIndicator steps={STEPS} current={step} />

          {stepError ? (
            <div className="auth-error" role="alert">
              <AlertCircle size={16} className="auth-error__icon" />
              <span>{stepError}</span>
            </div>
          ) : null}
          {submitError ? (
            <div className="auth-error" role="alert">
              <AlertCircle size={16} className="auth-error__icon" />
              <span>
                {submitError}{" "}
                {submitError.includes("já está cadastrado") ? <Link href="/login">Entrar</Link> : null}
              </span>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="register-pane">
              <h1 className="auth-form-panel__title">Crie sua conta</h1>
              <p className="auth-form-panel__sub">Comece o teste grátis de 14 dias. Sem cartão.</p>

              <GoogleButton label="Cadastrar com Google" />

              <div className="auth-divider">ou com e-mail</div>

              <AuthInput
                label="Nome completo"
                type="text"
                name="name"
                icon={<User size={18} />}
                placeholder="Maria Silva"
                autoComplete="name"
                value={state.adminName}
                onChange={(e) => update("adminName", e.target.value)}
                required
              />

              <AuthInput
                label="E-mail"
                type="email"
                name="email"
                icon={<Mail size={18} />}
                placeholder="voce@salao.com.br"
                autoComplete="email"
                value={state.adminEmail}
                onChange={(e) => update("adminEmail", e.target.value)}
                required
              />

              <AuthInput
                label="Senha"
                type="password"
                name="password"
                icon={<Lock size={18} />}
                placeholder="Crie uma senha forte"
                autoComplete="new-password"
                hint="Use 8+ caracteres com letras, números e símbolos."
                value={state.adminPassword}
                onChange={(e) => update("adminPassword", e.target.value)}
                required
              />
              <PasswordStrength password={state.adminPassword} />

              <div style={{ marginTop: 20 }}>
                <AuthButton type="button" block onClick={goNext} rightIcon={<ArrowRight size={18} />}>
                  Continuar
                </AuthButton>
              </div>

              <p className="auth-bottom-link">
                Já tem conta? <Link href="/login">Entrar</Link>
              </p>

              <div className="register-foot-note">
                <Lock size={12} /> Seus dados estão protegidos · LGPD
              </div>
            </div>
          ) : (
            <div className="register-pane">
              <h1 className="auth-form-panel__title">Sobre o seu salão</h1>
              <p className="auth-form-panel__sub">Usamos isso para montar sua página de agendamento.</p>

              <AuthInput
                label="Nome do estabelecimento"
                type="text"
                name="salonName"
                icon={<Store size={18} />}
                placeholder="Salão Bella"
                autoComplete="organization"
                value={state.companyName}
                onChange={(e) => update("companyName", e.target.value)}
                required
              />

              <AuthInput
                label="CPF ou CNPJ"
                type="text"
                name="document"
                icon={<FileText size={18} />}
                placeholder="000.000.000-00"
                value={state.document}
                onChange={(e) => update("document", formatCpfCnpj(e.target.value))}
                required
              />

              <AuthInput
                label="WhatsApp"
                type="tel"
                name="whatsapp"
                icon={<MessageCircle size={18} />}
                placeholder="(11) 99999-9999"
                autoComplete="tel"
                value={state.companyPhone}
                onChange={(e) => update("companyPhone", formatPhone(e.target.value))}
                required
              />

              <div className="auth-field">
                <span className="auth-field__label">Equipe</span>
                <div className="auth-team" role="radiogroup" aria-label="Tamanho da equipe">
                  {TEAM_OPTIONS.map((opt) => {
                    const selected = teamSize === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        className={`auth-team__btn${selected ? " auth-team__btn--selected" : ""}`}
                        onClick={() => setTeamSize(opt.value)}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="auth-field">
                <span className="auth-field__label">Tipo de negócio</span>
                <div className="auth-cards-grid">
                  {SEGMENTS.map((seg) => {
                    const selected = state.segment === seg.value;
                    return (
                      <div
                        key={seg.value}
                        role="radio"
                        aria-checked={selected}
                        tabIndex={0}
                        className={`auth-card${selected ? " auth-card--selected" : ""}`}
                        onClick={() => update("segment", seg.value)}
                        onKeyDown={(e) => onSegmentKeyDown(e, seg.value)}
                      >
                        <span className="auth-card__head">{seg.label}</span>
                        <span className="auth-card__desc">{seg.description}</span>
                        {selected ? <Check size={16} className="auth-card__check" /> : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              <label className="auth-checkbox register-terms">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                />
                <span>
                  Li e concordo com os <a href="/termos" target="_blank" rel="noreferrer">Termos de Uso</a> e a{" "}
                  <a href="/privacidade" target="_blank" rel="noreferrer">Política de Privacidade</a> da MarcaiFlex.
                </span>
              </label>

              <div className="auth-btn-row">
                <AuthButton type="button" variant="ghost" onClick={goBack} leftIcon={<ArrowLeft size={18} />} disabled={loading}>
                  Voltar
                </AuthButton>
                <AuthButton type="submit" loading={loading} rightIcon={loading ? null : <Check size={18} />}>
                  Criar conta grátis
                </AuthButton>
              </div>

              <div className="register-foot-note">
                <Lock size={12} /> Seus dados estão protegidos · LGPD
              </div>
            </div>
          )}
        </form>
      </section>
    </main>
  );
}
