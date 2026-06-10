import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Entrar na sua conta",
  description:
    "Acesse o painel de gestão do seu negócio. Agenda, clientes e financeiro em um só lugar.",
  robots: { index: false, follow: false }
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
