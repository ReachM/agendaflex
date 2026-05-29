"use client";

import { LogIn } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Mark } from "@/components/brand/Mark";
import { Wordmark } from "@/components/brand/Wordmark";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@marcaiflex.com");
  const [password, setPassword] = useState("Admin@123456");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "Não foi possível entrar.");
      return;
    }

    router.push(data.redirectTo ?? "/dashboard");
    router.refresh();
  }

  return (
    <form className="login-card grid" onSubmit={onSubmit}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <Mark size="lg" />
        <div>
          <Wordmark variant="dark" size="md" />
          <p className="muted" style={{ margin: "2px 0 0", fontSize: 13 }}>Acesse sua conta</p>
        </div>
      </div>

      {error ? <div className="error-box">{error}</div> : null}

      <div className="field">
        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          placeholder="seu@email.com"
        />
      </div>

      <div className="field">
        <label htmlFor="password">Senha</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          placeholder="••••••••"
        />
      </div>

      <button className="btn btn-primary" disabled={loading} type="submit" style={{ width: "100%", height: 44, fontSize: 14 }}>
        <LogIn size={18} />
        {loading ? "Entrando..." : "Entrar"}
      </button>

      <p className="register-foot muted">
        Não tem uma conta?{" "}
        <Link href="/cadastro" className="register-inline-link">
          Criar conta grátis
        </Link>
      </p>
    </form>
  );
}
