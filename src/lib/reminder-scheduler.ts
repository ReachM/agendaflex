import cron from "node-cron";
import { processEmailReminders } from "@/lib/services/appointment-reminder";
import { processReminders } from "@/lib/services/bot-reminder";

const LOG_PREFIX = "[Bot Reminder]";
const EMAIL_LOG_PREFIX = "[Email Reminder]";

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
    // Lembretes via WhatsApp (bot) — gated por plano/bot ligado.
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

    // Lembretes por e-mail — canal independente (não depende do bot). Roda no
    // mesmo tick de 15 min; idempotência própria via colunas reminderXhSentAt.
    processEmailReminders()
      .then((result) => {
        if (result.sent > 0 || result.failed > 0) {
          console.log(
            `${EMAIL_LOG_PREFIX} ciclo concluído: enviados=${result.sent} falhas=${result.failed} ignorados=${result.skipped}`
          );
        }
      })
      .catch((error) => {
        const detail = error instanceof Error ? error.message : "erro desconhecido";
        console.error(`${EMAIL_LOG_PREFIX} ciclo falhou: ${detail}`);
      });
  });

  console.log(`${LOG_PREFIX} agendador iniciado (intervalo de 15 min).`);
}
