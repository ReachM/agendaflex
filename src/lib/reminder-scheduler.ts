import cron from "node-cron";
import { processReminders } from "@/lib/services/bot-reminder";

const LOG_PREFIX = "[Bot Reminder]";

// Flag global para sobreviver ao hot-reload do dev e evitar múltiplos
// agendadores no mesmo processo Node.
const globalForCron = globalThis as typeof globalThis & {
  __marcaiflexReminderCronStarted?: boolean;
};

/**
 * Inicia o agendador interno (node-cron) que dispara os lembretes a cada 15 min.
 * Idempotente: só instancia um agendador por processo.
 */
export function startReminderScheduler(): void {
  if (globalForCron.__marcaiflexReminderCronStarted) return;
  globalForCron.__marcaiflexReminderCronStarted = true;

  cron.schedule("*/15 * * * *", () => {
    processReminders()
      .then((result) => {
        if (result.sent > 0 || result.failed > 0) {
          console.log(
            `${LOG_PREFIX} ciclo concluído: enviados=${result.sent} falhas=${result.failed} ignorados=${result.skipped}`
          );
        }
      })
      .catch((error) => {
        const detail = error instanceof Error ? error.message : "erro desconhecido";
        console.error(`${LOG_PREFIX} ciclo falhou: ${detail}`);
      });
  });

  console.log(`${LOG_PREFIX} agendador iniciado (intervalo de 15 min).`);
}
