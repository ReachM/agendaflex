import type { NextConfig } from "next";

/**
 * IMPORTANTE — .env:
 * O Next.js lê `.env`, `.env.local`, `.env.production`, etc. do diretório raiz
 * do projeto por padrão (process.cwd()). NÃO defina `envDir` aqui — apontar para
 * `".env"` faz o Next.js procurar `.env/.env` e gera ENOTDIR em produção quando
 * `.env` é arquivo (e não diretório). Se o erro ENOTDIR aparecer na VPS, o
 * culpado é o ambiente: provavelmente existe um DIRETÓRIO `.env/` no projeto
 * (ex.: alguém rodou `mkdir .env` por engano) — apague-o e crie um arquivo
 * `.env` regular. Confirme com `ls -la /home/deploy/agendaflex/.env`.
 */
const nextConfig: NextConfig = {
  poweredByHeader: false,
  eslint: {
    ignoreDuringBuilds: true
  },
  // node-cron usa APIs nativas do Node (child_process). Mantém fora do bundle
  // do webpack para ser carregado em runtime (usado pelo agendador interno via
  // src/instrumentation.ts).
  serverExternalPackages: ["node-cron"],
  webpack: (config) => {
    if (Array.isArray(config.externals)) {
      config.externals.push({ "node-cron": "commonjs node-cron" });
    }
    return config;
  }
};

export default nextConfig;
