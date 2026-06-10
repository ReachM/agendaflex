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
    "Plataforma de agendamento online para salões, barbearias e clínicas. Bot WhatsApp automático, lembretes inteligentes e gestão financeira. Teste grátis 14 dias.",
  keywords: [
    "agenda online salão de beleza",
    "software agendamento barbearia",
    "bot whatsapp agendamento",
    "sistema gestão salão",
    "agendamento online barbearia",
    "lembretes automáticos whatsapp salão",
    "agenda online para clínicas",
    "software gestão estética",
    "marcaiflex",
    "agendamento online gratuito"
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
      "Receba agendamentos 24h, envie lembretes automáticos no WhatsApp e gerencie seu salão em um só lugar. Teste grátis por 14 dias.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "MarcaiFlex — Agenda online com Bot WhatsApp para salões e barbearias"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "MarcaiFlex — Agenda online com Bot WhatsApp",
    description:
      "Receba agendamentos 24h, envie lembretes automáticos no WhatsApp e gerencie seu salão em um só lugar.",
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
