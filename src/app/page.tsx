import type { Metadata } from "next";
import { Landing } from "@/components/landing/landing";

const SITE_URL = "https://marcaiflex.com.br";

export const metadata: Metadata = {
  title: "MarcaiFlex — Agenda online com Bot WhatsApp para Salões e Barbearias",
  description:
    "Sistema de agendamento online para salões de beleza, barbearias, clínicas e estéticas. Bot WhatsApp com lembretes automáticos. Teste grátis 14 dias, sem cartão.",
  keywords: [
    "agenda online salão de beleza",
    "sistema agendamento barbearia",
    "bot whatsapp agendamento automático",
    "software gestão salão beleza",
    "agendamento online grátis",
    "lembretes whatsapp salão",
    "agenda clínica estética online",
    "marcar horário online barbearia",
    "sistema gestão financeiro salão",
    "agendamento 24 horas salão"
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: "MarcaiFlex — Agenda online com Bot WhatsApp",
    description:
      "Receba agendamentos 24h pelo link público, envie lembretes automáticos no WhatsApp e gerencie todo o seu salão em um só lugar. Teste grátis 14 dias.",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }]
  }
};

// JSON-LD: SoftwareApplication + Organization + FAQPage
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "MarcaiFlex",
      url: SITE_URL,
      description:
        "Sistema de agendamento online para salões de beleza, barbearias, clínicas e estéticas com bot de WhatsApp integrado.",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, iOS, Android",
      offers: [
        {
          "@type": "Offer",
          name: "Plano Starter",
          price: "49.00",
          priceCurrency: "BRL",
          priceValidUntil: "2027-12-31",
          availability: "https://schema.org/InStock"
        },
        {
          "@type": "Offer",
          name: "Plano Pro",
          price: "99.00",
          priceCurrency: "BRL",
          priceValidUntil: "2027-12-31",
          availability: "https://schema.org/InStock"
        },
        {
          "@type": "Offer",
          name: "Plano Max",
          price: "179.00",
          priceCurrency: "BRL",
          priceValidUntil: "2027-12-31",
          availability: "https://schema.org/InStock"
        }
      ],
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.9",
        reviewCount: "218",
        bestRating: "5"
      }
    },
    {
      "@type": "Organization",
      name: "MarcaiFlex",
      url: SITE_URL,
      logo: `${SITE_URL}/logo.png`,
      sameAs: ["https://instagram.com/marcaiflex", "https://facebook.com/marcaiflex"],
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: "contato@marcaiflex.com.br",
        availableLanguage: "Portuguese"
      }
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "O MarcaiFlex funciona para barbearias?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Sim! O MarcaiFlex foi desenvolvido para salões de beleza, barbearias, clínicas estéticas e SPAs. Cada tipo de negócio tem uma experiência personalizada."
          }
        },
        {
          "@type": "Question",
          name: "Precisa de cartão de crédito para testar?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Não. O teste gratuito dura 14 dias e não exige cartão de crédito. Você tem acesso a todas as funcionalidades do plano escolhido durante o período de teste."
          }
        },
        {
          "@type": "Question",
          name: "O bot de WhatsApp envia lembretes automáticos?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Sim! O plano Max inclui bot de WhatsApp que envia lembretes automáticos 24h e 2h antes do agendamento, reduzindo faltas em até 60%."
          }
        },
        {
          "@type": "Question",
          name: "Posso cancelar quando quiser?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Sim. Você pode cancelar sua assinatura a qualquer momento pelo painel de Configurações, sem multa ou fidelidade."
          }
        }
      ]
    }
  ]
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Landing />
    </>
  );
}
