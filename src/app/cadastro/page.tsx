import { RegisterForm } from "@/components/register-form";

export default function CadastroPage() {
  return (
    <main className="login-page">
      <section className="login-copy">
        <div className="brand-mark">AF</div>
        <h1>Comece em minutos</h1>
        <p>
          Crie sua conta no AgendaFlex e teste grátis por 7 dias, com todos os
          recursos liberados: agenda, clientes, serviços, profissionais e bot de
          WhatsApp. Sem cartão de crédito.
        </p>
      </section>
      <section className="login-panel">
        <RegisterForm />
      </section>
    </main>
  );
}
