"use client";

import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, KeyRound, Lock } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { AuthButton } from "@/components/auth/AuthButton";
import { AuthInput } from "@/components/auth/AuthInput";
import { Mark } from "@/components/brand/Mark";
import { Wordmark } from "@/components/brand/Wordmark";
import "../forgot-password/forgot-password.css";

function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError("");

    if (!token) {
      setError("Link inválido ou expirado. Solicite um novo.");
      return;
    }
    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Não foi possível redefinir a senha.");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <>
        <div className="forgot-card__hero forgot-card__hero--green">
          <CheckCircle2 size={26} />
        </div>
        <h1 className="forgot-card__title">Senha redefinida</h1>
        <p className="forgot-card__sub">Sua senha foi atualizada com sucesso. Já pode entrar com a nova senha.</p>
        <Link href="/login" className="auth-btn auth-btn--primary auth-btn--block" style={{ marginTop: 8 }}>
          Ir para o login
        </Link>
      </>
    );
  }

  return (
    <>
      <div className="forgot-card__hero forgot-card__hero--teal">
        <KeyRound size={26} />
      </div>
      <h1 className="forgot-card__title">Criar nova senha</h1>
      <p className="forgot-card__sub">Escolha uma nova senha para a sua conta. Use pelo menos 8 caracteres.</p>

      <form onSubmit={onSubmit} noValidate>
        {error ? (
          <div className="auth-error" role="alert">
            <AlertCircle size={16} className="auth-error__icon" />
            <span>{error}</span>
          </div>
        ) : null}

        <AuthInput
          label="Nova senha"
          type="password"
          name="password"
          icon={<Lock size={18} />}
          placeholder="••••••••"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <AuthInput
          label="Confirmar nova senha"
          type="password"
          name="confirm"
          icon={<Lock size={18} />}
          placeholder="••••••••"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />

        <AuthButton type="submit" block loading={loading} rightIcon={loading ? null : <ArrowRight size={18} />}>
          Redefinir senha
        </AuthButton>
      </form>

      <Link href="/login" className="forgot-card__back">
        <ArrowLeft size={14} /> Voltar para o login
      </Link>

      <div className="forgot-card__foot">🔒 Conexão segura · MarcaiFlex</div>
    </>
  );
}

export default function RedefinirSenhaPage() {
  return (
    <main className="forgot-shell">
      <div className="forgot-card">
        <div className="forgot-card__logo">
          <Mark size="md" />
          <Wordmark variant="dark" size="md" />
        </div>
        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
