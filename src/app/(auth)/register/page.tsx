"use client";

import { AlertCircle, ArrowLeft, ArrowRight, Check, FileText, KeyRound, Lock, Mail, MessageCircle, Store, User } from "lucide-react";
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

const STEPS = [{ label: "Sua conta" }, { label: "Verificar e-mail" }, { label: "Seu negócio" }];
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

  // Verificação de e-mail (step 2)
  const [verificationCode, setVerificationCode] = useState("");

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
      return "Informe o WhatsApp do negócio.";
    }
    if (!state.segment) return "Escolha o tipo de negócio.";
    if (!acceptTerms) return "Você precisa aceitar os Termos e a Política de Privacidade.";
    return null;
  }

  // Step 1 → envia o código de verificação e avança para o step de confirmação.
  // Também usado como "Reenviar código" dentro do step 2.
  async function handleStep1Next() {
    const error = validateStep1();
    if (error) {
      setStepError(error);
      return;
    }
    setStepError("");
    setSubmitError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: state.adminEmail.trim().toLowerCase() })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStepError(data.error ?? "Erro ao enviar código.");
        return;
      }
      setVerificationCode("");
      setStep(2);
    } catch {
      setStepError("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  // Step 2 → valida o código contra a API antes de avançar (sem consumi-lo).
  async function handleVerifyCode() {
    if (verificationCode.length !== 6) return;
    setStepError("");
    setSubmitError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-email-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: state.adminEmail.trim().toLowerCase(),
          code: verificationCode
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStepError(data.error ?? "Código inválido ou expirado.");
        return;
      }
      setStep(3);
    } catch {
      setStepError("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function goBack() {
    setStepError("");
    setSubmitError("");
    setStep((prev) => Math.max(1, prev - 1));
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

    // Step 2: verificar código de e-mail antes de avançar.
    if (step === 2) {
      await handleVerifyCode();
      return;
    }

    // Step 3: validar dados da empresa.
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
        body: JSON.stringify(buildRegisterBody(state, verificationCode))
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

          {step === 1 && (
            <div className="register-pane">
              <h1 className="auth-form-panel__title">Crie sua conta</h1>
              <p className="auth-form-panel__sub">Comece o teste grátis de 7 dias. Sem cartão.</p>

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
                placeholder="voce@seunegocio.com.br"
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
                <AuthButton
                  type="button"
                  block
                  loading={loading}
                  onClick={handleStep1Next}
                  rightIcon={loading ? null : <ArrowRight size={18} />}
                >
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
          )}

          {step === 2 && (
            <div className="register-pane">
              <h1 className="auth-form-panel__title">Verifique seu e-mail</h1>
              <p className="auth-form-panel__sub">
                Enviamos um código para <strong>{state.adminEmail}</strong>. Válido por 10 minutos.
              </p>

              <AuthInput
                label="Código de verificação"
                type="text"
                name="verificationCode"
                icon={<KeyRound size={18} />}
                placeholder="000000"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                autoFocus
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                style={{ fontSize: 24, letterSpacing: 8, textAlign: "center" }}
              />

              <div style={{ marginTop: 20 }}>
                <AuthButton
                  type="submit"
                  block
                  loading={loading}
                  disabled={verificationCode.length < 6}
                  rightIcon={loading ? null : <ArrowRight size={18} />}
                >
                  Verificar e avançar
                </AuthButton>
              </div>

              <div className="auth-btn-row" style={{ marginTop: 12 }}>
                <AuthButton type="button" variant="ghost" onClick={goBack} leftIcon={<ArrowLeft size={18} />} disabled={loading}>
                  Voltar
                </AuthButton>
                <AuthButton type="button" variant="ghost" onClick={handleStep1Next} loading={loading}>
                  Reenviar código
                </AuthButton>
              </div>

              <div className="register-foot-note">
                <Lock size={12} /> Seus dados estão protegidos · LGPD
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="register-pane">
              <h1 className="auth-form-panel__title">Sobre o seu negócio</h1>
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
