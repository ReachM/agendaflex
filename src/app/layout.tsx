import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { CookieBanner } from "@/components/cookie-banner";
import "@/components/cookie-banner.css";

const SITE_URL = "https://marcaiflex.com.br";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "MarcaiFlex — Agenda online com Bot WhatsApp",
    template: "%s | MarcaiFlex"
  },
  description:
    "Plataforma de agendamento online para clínicas, salões, barbearias, oficinas e qualquer negócio com horário marcado. Bot WhatsApp, lembretes automáticos e gestão financeira. Teste grátis 7 dias.",
  keywords: [
    "agenda online",
    "software agendamento online",
    "bot whatsapp agendamento",
    "software agendamento clínica",
    "agenda barbearia online",
    "agendamento online salão",
    "lembretes automáticos whatsapp",
    "sistema gestão agendamento",
    "marcaiflex",
    "marcar horário online"
  ],
  authors: [{ name: "MarcaiFlex", url: SITE_URL }],
  creator: "MarcaiFlex",
  publisher: "MarcaiFlex",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1
    }
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: SITE_URL,
    siteName: "MarcaiFlex",
    title: "MarcaiFlex — Agenda online com Bot WhatsApp",
    description:
      "Receba agendamentos 24h pelo link público, envie lembretes automáticos no WhatsApp e gerencie seu negócio em um só lugar. Teste grátis por 7 dias.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "MarcaiFlex — Agenda online com Bot WhatsApp para qualquer negócio"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "MarcaiFlex — Agenda online com Bot WhatsApp",
    description:
      "Receba agendamentos 24h, envie lembretes automáticos no WhatsApp e gerencie seu negócio em um só lugar.",
    images: ["/og-image.png"],
    creator: "@marcaiflex"
  },
  alternates: {
    canonical: SITE_URL
  },
  verification: {
    google: "tQQLQvhIgDeODf_eayfKorJyXPB4iEKhUK4WF_VLx24"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.variable} ${jetbrainsMono.variable}`}>
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
