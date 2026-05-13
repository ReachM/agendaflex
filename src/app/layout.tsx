import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgendaFlex",
  description: "SaaS multi-tenant de agendamento e controle de serviços"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
