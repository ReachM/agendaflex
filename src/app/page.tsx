import type { Metadata } from "next";
import { Landing } from "@/components/landing/landing";

const SITE_URL = "https://marcaiflex.com.br";

export const metadata: Metadata = {
  title: "MarcaiFlex — Agenda online com Bot WhatsApp",
  description:
    "Sistema de agendamento online para clínicas, salões, barbearias, estéticas, oficinas e qualquer negócio com horário marcado. Bot WhatsApp automático. Teste grátis 7 dias, sem cartão.",
  keywords: [
    "agenda online",
    "sistema agendamento online",
    "bot whatsapp agendamento",
    "software agendamento clínica",
    "agenda online barbearia",
    "sistema gestão salão",
    "agendamento online grátis",
    "lembretes whatsapp automático",
    "agenda online pet shop",
    "agendamento online consultório",
    "software agendamento estética",
    "marcar horário online"
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: "MarcaiFlex — Agenda online com Bot WhatsApp",
    description:
      "Receba agendamentos 24h pelo link público, envie lembretes automáticos no WhatsApp e gerencie seu negócio em um só lugar. Teste grátis por 7 dias.",
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
        "Sistema de agendamento online para qualquer negócio que trabalha com horário marcado. Bot WhatsApp automático, lembretes inteligentes, controle financeiro e link público de agendamento.",
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
          name: "Para quais tipos de negócio o MarcaiFlex funciona?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "O MarcaiFlex funciona para qualquer negócio que trabalha com horário marcado: clínicas, consultórios, salões de beleza, barbearias, estéticas, SPAs, oficinas mecânicas, pet shops, estúdios de tatuagem, personal trainers, psicólogos, dentistas e muito mais."
          }
        },
        {
          "@type": "Question",
          name: "Precisa de cartão de crédito para testar?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Não. O teste gratuito dura 7 dias e não exige cartão de crédito. Você tem acesso a todas as funcionalidades do plano escolhido durante o período de teste."
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
