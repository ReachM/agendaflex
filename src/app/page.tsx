import type { Metadata } from "next";
import { Landing } from "@/components/landing/landing";

export const metadata: Metadata = {
  title: "MarcaiFlex — Agendamento online sem fricção para o seu negócio",
  description:
    "Agenda online, lembretes por WhatsApp, múltiplos profissionais e relatórios em um só lugar. Para clínicas, salões, oficinas e prestadores de serviço. Teste grátis por 7 dias.",
  keywords: [
    "agendamento online",
    "agenda para clínicas",
    "agenda para salão",
    "lembrete whatsapp",
    "software de agendamento",
    "SaaS agendamento"
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    title: "MarcaiFlex — Agendamento online sem fricção",
    description:
      "Agenda online, lembretes por WhatsApp, múltiplos profissionais e relatórios. Teste grátis por 7 dias.",
    siteName: "MarcaiFlex"
  },
  twitter: {
    card: "summary_large_image",
    title: "MarcaiFlex — Agendamento online sem fricção",
    description:
      "Agenda online, lembretes por WhatsApp, múltiplos profissionais e relatórios. Teste grátis por 7 dias."
  }
};

export default function HomePage() {
  return <Landing />;
}
