import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

const SITE_URL = "https://marcaiflex.com.br";

// Depende de dados do banco (empresas ativas) — gerar a cada request em vez de
// congelar no build (onde não há DATABASE_URL e a lista sairia vazia).
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Páginas estáticas
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0
    },
    {
      url: `${SITE_URL}/register`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.9
    },
    {
      url: `${SITE_URL}/login`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3
    },
    {
      url: `${SITE_URL}/termos`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.4
    },
    {
      url: `${SITE_URL}/privacidade`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.4
    }
  ];

  // Páginas dinâmicas de agendamento público
  let publicBookingPages: MetadataRoute.Sitemap = [];
  try {
    const companies = await prisma.company.findMany({
      where: {
        status: "ACTIVE",
        publicBookingEnabled: true,
        slug: { not: null }
      },
      select: { slug: true, updatedAt: true },
      take: 1000 // limitar para não sobrecarregar
    });

    publicBookingPages = companies
      .filter((c) => c.slug)
      .map((c) => ({
        url: `${SITE_URL}/agendar/${c.slug}`,
        lastModified: c.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.7
      }));
  } catch {
    // falha silenciosa — sitemap ainda funciona sem as páginas dinâmicas
  }

  return [...staticPages, ...publicBookingPages];
}
