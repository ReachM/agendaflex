"use client";

import { AlertCircle, ArrowLeft, ArrowRight, KeyRound, Lock, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { AuthButton } from "@/components/auth/AuthButton";
import { AuthInput } from "@/components/auth/AuthInput";
import { BrandPanel } from "@/components/auth/BrandPanel";
import { GoogleButton } from "@/components/auth/GoogleButton";
import "./login.css";

/** Mensagens dos erros de OAuth devolvidos via ?error= pelas rotas /api/auth/google*. */
const OAUTH_ERRORS: Record<string, string> = {
  oauth_failed: "Erro ao conectar com o Google. Tente novamente.",
  invalid_state: "Sessão expirada. Tente novamente.",
  cancelled: "Login cancelado.",
  account_suspended: "Conta suspensa. Entre em contato com o suporte.",
  oauth_unavailable: "Login com Google indisponível no momento."
};

function LoginContent() {
  const router = useRouter();
  const oauthErrorKey = useSearchParams().get("error");
  const oauthError = oauthErrorKey ? OAUTH_ERRORS[oauthErrorKey] : undefined;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 2º fator (OTP) — após a senha correta o login envia um código por e-mail.
  const [otpRequired, setOtpRequired] = useState(false);
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);

    let response: Response;
    try {
      response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe })
      });
    } catch {
      setLoading(false);
      setError("Falha de conexão. Tente novamente.");
      return;
    }

    const data = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "E-mail ou senha inválidos.");
      return;
    }

    if (data.otpRequired) {
      setOtpRequired(true);
      setOtpEmail(data.email ?? email);
      setOtpCode("");
      return;
    }

    router.push(data.redirectTo ?? "/dashboard");
    router.refresh();
  }

  async function onOtpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || otpCode.length < 6) return;
    setError("");
    setLoading(true);

    let response: Response;
    try {
      response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: otpEmail, code: otpCode, rememberMe })
      });
    } catch {
      setLoading(false);
      setError("Falha de conexão. Tente novamente.");
      return;
    }

    const data = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "Código inválido ou expirado.");
      return;
    }

    router.push(data.redirectTo ?? "/dashboard");
    router.refresh();
  }

  return (
    <main className="auth-wrap">
      <BrandPanel variant="login" />

      <section className="auth-form-panel">
        <div className="auth-form-panel__top">
          <span>Ainda não tem conta?</span>
          <Link href="/register">Começar grátis</Link>
        </div>

        {otpRequired ? (
          <form className="auth-form-panel__body" onSubmit={onOtpSubmit} noValidate>
            <h1 className="auth-form-panel__title">Verifique seu e-mail</h1>
            <p className="auth-form-panel__sub">
              Código enviado para <strong>{otpEmail}</strong>. Válido por 10 minutos.
            </p>

            {error ? (
              <div className="auth-error" role="alert">
                <AlertCircle size={16} className="auth-error__icon" />
                <span>{error}</span>
              </div>
            ) : null}

            <AuthInput
              label="Código de acesso"
              type="text"
              name="otp"
              icon={<KeyRound size={18} />}
              placeholder="000000"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              style={{ fontSize: 24, letterSpacing: 8, textAlign: "center" }}
            />

            <AuthButton
              type="submit"
              block
              loading={loading}
              disabled={otpCode.length < 6}
              rightIcon={loading ? null : <ArrowRight size={18} />}
            >
              Entrar
            </AuthButton>

            <div style={{ marginTop: 12 }}>
              <AuthButton
                type="button"
                variant="ghost"
                block
                leftIcon={<ArrowLeft size={18} />}
                disabled={loading}
                onClick={() => {
                  setOtpRequired(false);
                  setOtpCode("");
                  setError("");
                }}
              >
                Voltar
              </AuthButton>
            </div>
          </form>
        ) : (
        <form className="auth-form-panel__body" onSubmit={onSubmit} noValidate>
          <h1 className="auth-form-panel__title">Bem-vindo de volta</h1>
          <p className="auth-form-panel__sub">Entre para acessar a agenda do seu negócio.</p>

          {error ? (
            <div className="auth-error" role="alert">
              <AlertCircle size={16} className="auth-error__icon" />
              <span>{error}</span>
            </div>
          ) : null}

          {!error && oauthError ? (
            <div className="auth-error" role="alert">
              <AlertCircle size={16} className="auth-error__icon" />
              <span>{oauthError}</span>
            </div>
          ) : null}

          <GoogleButton />

          <div className="auth-divider">ou entre com e-mail</div>

          <AuthInput
            label="E-mail"
            type="email"
            name="email"
            icon={<Mail size={18} />}
            placeholder="voce@salao.com.br"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <AuthInput
            label="Senha"
            type="password"
            name="password"
            icon={<Lock size={18} />}
            placeholder="Sua senha"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            rightSlot={
              <Link href="/forgot-password" className="auth-field__hint-link">
                Esqueceu a senha?
              </Link>
            }
          />

          <div className="login-remember">
            <label className="auth-checkbox">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>Manter conectado neste dispositivo</span>
            </label>
          </div>

          <AuthButton type="submit" block loading={loading} rightIcon={loading ? null : <ArrowRight size={18} />}>
            Entrar
          </AuthButton>

          <p className="auth-bottom-link">
            Novo na MarcaiFlex?{" "}
            <Link href="/register">Crie sua conta em 2 minutos</Link>
          </p>

          <div className="auth-form-panel__foot">
            <span className="auth-form-panel__foot-secure">
              <Lock size={12} /> Conexão segura
            </span>
            <span>
              <a href="/termos">Termos</a> · <a href="/privacidade">Privacidade</a> ·{" "}
              <a href="mailto:contato@marcaiflex.com.br">Suporte</a>
            </span>
          </div>
        </form>
        )}
      </section>
    </main>
  );
}

// useSearchParams() exige um boundary de Suspense para o build do Next (CSR bailout).
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
