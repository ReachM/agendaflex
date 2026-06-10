import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Central de Ajuda",
  description:
    "Aprenda a usar todas as funcionalidades do MarcaiFlex. Guias passo a passo para agenda, clientes, financeiro e bot WhatsApp.",
  robots: { index: false, follow: false }
};

export default function AjudaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
