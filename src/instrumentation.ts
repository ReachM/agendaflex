/**
 * Next.js instrumentation: register() roda UMA vez no bootstrap do servidor.
 * Usamos para subir o agendador interno (node-cron) dos lembretes.
 *
 * - Só no runtime Node (nunca no edge).
 * - Só em produção (next start no container); em dev o cron fica desligado
 *   para não duplicar com o hot-reload.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production") return;

  const { startReminderScheduler } = await import("./lib/reminder-scheduler");
  startReminderScheduler();
}
