/**
 * PM2 ecosystem para o MarcaiFlex.
 *
 * Uso na VPS:
 *   pm2 start ecosystem.config.cjs --env production
 *   pm2 reload ecosystem.config.cjs --update-env   # após `npm run build`
 *   pm2 save                                       # persiste para restart na boot
 *
 * IMPORTANTE — instances = 1 (fork):
 *   src/instrumentation.ts sobe um node-cron INTERNO (lembretes do bot WhatsApp).
 *   Múltiplas réplicas significam múltiplos crons disparando os mesmos jobs.
 *   O `SentReminder` (@@unique) bloqueia mensagem duplicada, mas é trabalho
 *   redundante. Se for escalar horizontalmente, mantenha o cron em UMA única
 *   réplica/worker dedicado.
 */
module.exports = {
  apps: [
    {
      name: "marcaiflex",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      // .env é carregado pelo próprio Next (e tem fallback em instrumentation.ts).
      // Aqui só garantimos o NODE_ENV.
      env: {
        NODE_ENV: "production"
      },
      max_memory_restart: "1G",
      // Logs combinados (stdout+stderr) — facilita `pm2 logs marcaiflex`.
      out_file: "./logs/pm2-out.log",
      error_file: "./logs/pm2-err.log",
      merge_logs: true,
      time: true,
      // Restart se travar (mas não restart-loop): espera 5s entre tentativas,
      // aborta após 10 falhas consecutivas em menos de 1min.
      min_uptime: "60s",
      max_restarts: 10,
      restart_delay: 5000
    }
  ]
};
