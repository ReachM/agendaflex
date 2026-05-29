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
  turbopack: {
    root: import.meta.dirname,
  },
  // node-cron usa APIs nativas do Node (child_process). Mantém fora do bundle
  // do webpack para ser carregado em runtime (usado pelo agendador interno via
  // src/instrumentation.ts).
  serverExternalPackages: ["node-cron"],
  webpack: (config, { isServer }) => {
    if (Array.isArray(config.externals)) {
      config.externals.push({ "node-cron": "commonjs node-cron" });
    }
    // No bundle do servidor, deixa builtins do Node (`path`, `fs`, ...) como
    // externals do CommonJS. Sem isso, o webpack do Next emite warnings ao
    // processar imports dinâmicos em src/instrumentation.ts.
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)),
        { path: "commonjs path", fs: "commonjs fs" }
      ];
    }
    return config;
  }
};

export default nextConfig;
