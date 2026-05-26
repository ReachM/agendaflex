import type { Metadata } from "next";
import { Landing } from "@/components/landing/landing";

const SITE_URL = "https://marcaiflex.com.br";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "MarcaiFlex — Agenda online com Bot WhatsApp",
  description:
    "Gerencie sua agenda e deixe o bot responder pelo WhatsApp. Teste grátis por 7 dias.",
  keywords: [
    "agenda online",
    "bot whatsapp",
    "agendamento whatsapp",
    "agendamento online",
    "agenda para salão",
    "agenda para clínicas",
    "agenda para barbearia",
    "lembrete automático whatsapp",
    "software de agendamento",
    "marcar horário online"
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: SITE_URL,
    title: "MarcaiFlex — Agenda online com Bot WhatsApp",
    description:
      "Gerencie sua agenda e deixe o bot responder pelo WhatsApp. Teste grátis por 7 dias.",
    siteName: "MarcaiFlex"
  },
  twitter: {
    card: "summary_large_image",
    title: "MarcaiFlex — Agenda online com Bot WhatsApp",
    description:
      "Gerencie sua agenda e deixe o bot responder pelo WhatsApp. Teste grátis por 7 dias."
  }
};

export default function HomePage() {
  return <Landing />;
}
