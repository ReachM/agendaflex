"use client";

import { AlertCircle, ArrowLeft, ArrowRight, Lock, Mail, MailCheck } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { AuthButton } from "@/components/auth/AuthButton";
import { AuthInput } from "@/components/auth/AuthInput";
import { Mark } from "@/components/brand/Mark";
import { Wordmark } from "@/components/brand/Wordmark";
import "./forgot-password.css";

const RESEND_SECONDS = 30;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function submit(targetEmail: string) {
    let response: Response;
    try {
      response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail })
      });
    } catch {
      throw new Error("Falha de conexão. Tente novamente.");
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error ?? "Não foi possível enviar o e-mail. Tente novamente.");
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      await submit(email);
      setSent(true);
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    if (cooldown > 0 || loading) return;
    setError("");
    setLoading(true);
    try {
      await submit(email);
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="forgot-shell">
      <div className="forgot-card">
        <div className="forgot-card__logo">
          <Mark size="md" />
          <Wordmark variant="dark" size="md" />
        </div>

        {!sent ? (
          <>
            <div className="forgot-card__hero forgot-card__hero--teal">
              <Lock size={26} />
            </div>
            <h1 className="forgot-card__title">Esqueceu a senha?</h1>
            <p className="forgot-card__sub">
              Sem problema. Informe o e-mail da sua conta e enviaremos um link para você criar uma nova senha.
            </p>

            <form onSubmit={onSubmit} noValidate>
              {error ? (
                <div className="auth-error" role="alert">
                  <AlertCircle size={16} className="auth-error__icon" />
                  <span>{error}</span>
                </div>
              ) : null}

              <AuthInput
                label="E-mail da conta"
                type="email"
                name="email"
                icon={<Mail size={18} />}
                placeholder="voce@salao.com.br"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <AuthButton type="submit" block loading={loading} rightIcon={loading ? null : <ArrowRight size={18} />}>
                Enviar link de recuperação
              </AuthButton>
            </form>

            <Link href="/login" className="forgot-card__back">
              <ArrowLeft size={14} /> Voltar para o login
            </Link>

            <div className="forgot-card__foot">🔒 Conexão segura · MarcaiFlex</div>
          </>
        ) : (
          <>
            <div className="forgot-card__hero forgot-card__hero--green">
              <MailCheck size={26} />
            </div>
            <h1 className="forgot-card__title">Verifique seu e-mail</h1>
            <p className="forgot-card__sub">Enviamos um link de recuperação para:</p>

            <div className="forgot-pill-row">
              <span className="forgot-email-pill">
                <Mail size={16} className="forgot-email-pill__icon" />
                {email}
              </span>
            </div>

            <a className="auth-btn auth-btn--primary auth-btn--block" href="https://mail.google.com" target="_blank" rel="noreferrer">
              Abrir meu e-mail
            </a>

            <p className="forgot-note" style={{ marginTop: 16 }}>
              O link expira em <strong>30 minutos</strong>. Não encontrou? Verifique a caixa de spam ou a aba Promoções.
            </p>

            {error ? (
              <div className="auth-error" role="alert">
                <AlertCircle size={16} className="auth-error__icon" />
                <span>{error}</span>
              </div>
            ) : null}

            <p className="forgot-resend">
              Não recebeu?{" "}
              <button type="button" onClick={onResend} disabled={cooldown > 0 || loading}>
                {cooldown > 0 ? `Reenviar em ${cooldown}s` : "Reenviar e-mail"}
              </button>
            </p>

            <Link href="/login" className="forgot-card__back">
              <ArrowLeft size={14} /> Voltar para o login
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
