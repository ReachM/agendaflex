"use client";

import { CalendarClock, LogIn } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@agendaflex.com");
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
      <div className="toolbar">
        <div>
          <h2>Entrar</h2>
          <p className="muted">AgendaFlex</p>
        </div>
        <CalendarClock size={24} />
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
        />
      </div>

      <button className="button" disabled={loading} type="submit">
        <LogIn size={18} />
        {loading ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
