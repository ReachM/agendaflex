import type { MetadataRoute } from "next";

const SITE_URL = "https://marcaiflex.com.br";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/register", "/termos", "/privacidade", "/agendar/"],
        disallow: [
          "/api/",
          "/dashboard",
          "/agenda",
          "/clientes",
          "/profissionais",
          "/servicos",
          "/financeiro",
          "/relatorios",
          "/configuracoes",
          "/usuarios",
          "/notas-fiscais",
          "/link-agenda",
          "/logs",
          "/ajuda",
          "/master",
          "/cadastro"
        ]
      },
      {
        // Bloquear bots de IA de rastrear o site
        userAgent: ["GPTBot", "Claude-Web", "anthropic-ai", "CCBot"],
        disallow: ["/"]
      }
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL
  };
}
