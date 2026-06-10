import type { Metadata } from "next";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import PublicBookingClient from "./booking-client";

const SITE_URL = "https://marcaiflex.com.br";

// Rótulos por segmento (alinhados ao enum BusinessSegment do schema)
const SEGMENT_LABELS: Record<string, string> = {
  CLINICA_MEDICA: "clínica",
  OFICINA_MECANICA: "oficina mecânica",
  SALAO_BELEZA: "salão de beleza",
  CONSULTORIO: "consultório",
  ASSISTENCIA_TECNICA: "assistência técnica",
  PRESTADOR_SERVICOS: "prestador de serviços",
  PERSONALIZADO: "estabelecimento"
};

// Tipos Schema.org por segmento
const SEGMENT_SCHEMA_TYPE: Record<string, string> = {
  CLINICA_MEDICA: "MedicalClinic",
  OFICINA_MECANICA: "AutoRepair",
  SALAO_BELEZA: "HairSalon",
  CONSULTORIO: "MedicalBusiness",
  ASSISTENCIA_TECNICA: "LocalBusiness",
  PRESTADOR_SERVICOS: "LocalBusiness",
  PERSONALIZADO: "LocalBusiness"
};

// cache() evita consultar o banco duas vezes (generateMetadata + página)
const getCompany = cache(async (slug: string) => {
  return prisma.company
    .findUnique({
      where: { slug },
      select: { name: true, tradeName: true, phone: true, segment: true, status: true }
    })
    .catch(() => null);
});

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const company = await getCompany(slug);

  if (!company || company.status !== "ACTIVE") {
    return { title: "Agendamento Online" };
  }

  const displayName = company.tradeName ?? company.name;
  const title = `Agendar horário — ${displayName}`;
  const description = `Agende seu horário no ${displayName} de forma rápida e fácil. Escolha o serviço, profissional e horário disponível. Confirmação imediata!`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: `${SITE_URL}/agendar/${slug}`,
      siteName: displayName,
      images: [{ url: "/og-image.png", width: 1200, height: 630 }]
    },
    twitter: {
      card: "summary",
      title,
      description
    },
    robots: {
      index: true,
      follow: true
    },
    alternates: {
      canonical: `/agendar/${slug}`
    }
  };
}

export default async function PublicBookingPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const company = await getCompany(slug);

  const jsonLd =
    company && company.status === "ACTIVE"
      ? {
          "@context": "https://schema.org",
          "@type": SEGMENT_SCHEMA_TYPE[company.segment] ?? "LocalBusiness",
          name: company.tradeName ?? company.name,
          telephone: company.phone ?? undefined,
          url: `${SITE_URL}/agendar/${slug}`,
          makesOffer: {
            "@type": "Offer",
            description: `Agendamento online — ${SEGMENT_LABELS[company.segment] ?? "estabelecimento"}`
          }
        }
      : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <PublicBookingClient />
    </>
  );
}
