import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Criar conta grátis — 14 dias sem cartão",
  description:
    "Crie sua conta no MarcaiFlex e comece a receber agendamentos online em 2 minutos. Teste grátis por 14 dias, sem cartão de crédito.",
  alternates: { canonical: "/register" },
  openGraph: {
    title: "Criar conta grátis no MarcaiFlex",
    description: "Comece a receber agendamentos online em 2 minutos. 14 dias grátis, sem cartão.",
    images: [{ url: "/og-image.png" }]
  }
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
