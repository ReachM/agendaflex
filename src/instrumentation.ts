/**
 * Next.js instrumentation: register() roda UMA vez no bootstrap do servidor.
 * Duas responsabilidades:
 *   1) Garantir que o `.env` foi lido em produção (defesa contra ENOTDIR quando
 *      o cwd do processo PM2 não bate com a raiz do projeto).
 *   2) Subir o agendador interno (node-cron) dos lembretes.
 *
 * - Só no runtime Node (nunca no edge).
 * - O carregamento de `.env` e o cron só rodam em produção; em dev o Next.js já
 *   cuida do `.env` e o hot-reload duplicaria o cron.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production") return;

  // ── (1) Garantia de .env em produção ──────────────────────────────
  // Lemos `.env` com path absoluto baseado em process.cwd(), sem sobrescrever
  // envs já existentes (PM2/systemd têm precedência — quem foi setado por fora
  // vence). `path` e `fs` estão em `serverExternalPackages` no next.config para
  // o webpack não tentar bundlar os builtins do Node.
  try {
    const path = await import("path");
    const fs = await import("fs");

    const projectRoot = process.cwd();
    const envPath = path.join(projectRoot, ".env");
    try {
      const content = fs.readFileSync(envPath, "utf8");
      let loaded = 0;
      for (const rawLine of content.split("\n")) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const eqIdx = line.indexOf("=");
        if (eqIdx < 0) continue;
        const key = line.substring(0, eqIdx).trim();
        let value = line.substring(eqIdx + 1).trim();
        // Aspas envolventes (KEY="value" ou KEY='value') — comum em .env
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        // Não sobrescreve env já presente (PM2/systemd têm prioridade).
        if (key && process.env[key] === undefined) {
          process.env[key] = value;
          loaded++;
        }
      }
      console.log(`[Startup] .env carregado de: ${envPath} (${loaded} variável(is) novas, cwd=${process.cwd()})`);
    } catch (err) {
      console.warn(
        "[Startup] Não foi possível carregar .env:",
        err instanceof Error ? err.message : String(err)
      );
    }
  } catch (err) {
    console.warn(
      "[Startup] Falha ao preparar carregamento de .env:",
      err instanceof Error ? err.message : String(err)
    );
  }

  // ── (2) Cron de lembretes ─────────────────────────────────────────
  // Sobe APÓS as envs estarem garantidas. Idempotente (ver reminder-scheduler).
  const { startReminderScheduler } = await import("./lib/reminder-scheduler");
  startReminderScheduler();
}
