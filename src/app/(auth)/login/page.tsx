"use client";

import { AlertCircle, ArrowRight, Lock, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AuthButton } from "@/components/auth/AuthButton";
import { AuthInput } from "@/components/auth/AuthInput";
import { BrandPanel } from "@/components/auth/BrandPanel";
import { GoogleButton } from "@/components/auth/GoogleButton";
import "./login.css";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

        <form className="auth-form-panel__body" onSubmit={onSubmit} noValidate>
          <h1 className="auth-form-panel__title">Bem-vindo de volta</h1>
          <p className="auth-form-panel__sub">Entre para acessar a agenda do seu salão.</p>

          {error ? (
            <div className="auth-error" role="alert">
              <AlertCircle size={16} className="auth-error__icon" />
              <span>{error}</span>
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
      </section>
    </main>
  );
}
