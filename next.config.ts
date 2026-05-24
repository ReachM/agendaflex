import type { NextConfig } from "next";

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
