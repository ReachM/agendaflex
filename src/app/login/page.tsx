import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-copy">
        <div className="brand-mark">AF</div>
        <h1>AgendaFlex</h1>
        <p>
          Plataforma SaaS multi-tenant para agendamento, clientes, serviços,
          profissionais e campos personalizados por empresa.
        </p>
      </section>
      <section className="login-panel">
        <LoginForm />
      </section>
    </main>
  );
}
