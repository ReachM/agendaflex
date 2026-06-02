/** Utilidades de data para a grade semanal (segunda → domingo). */

export const HOUR_HEIGHT = 56;
export const START_HOUR = 8;
export const END_HOUR = 20;
export const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Segunda-feira da semana que contém `date`. */
export function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  const day = d.getDay(); // 0=dom, 1=seg, ...
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/**
 * Retorna o topo (em px) e a altura (em px) para um intervalo dentro da grade
 * 8h–20h. Se o intervalo cair fora, é clampado pelos limites — o card ainda
 * aparece, mas só dentro do espaço visível.
 */
export function rectForRange(start: Date, end: Date): { top: number; height: number } {
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  const gridStart = START_HOUR * 60;
  const gridEnd = END_HOUR * 60 + 60;
  const clampedStart = Math.max(startMinutes, gridStart);
  const clampedEnd = Math.min(endMinutes, gridEnd);
  const top = ((clampedStart - gridStart) / 60) * HOUR_HEIGHT;
  const height = Math.max(20, ((clampedEnd - clampedStart) / 60) * HOUR_HEIGHT - 2);
  return { top, height };
}

const WEEK_LABEL_LOCALE = "pt-BR";

export function formatWeekLabel(weekStart: Date): { range: string; year: number } {
  const weekEnd = addDays(weekStart, 6);
  const startMonth = new Intl.DateTimeFormat(WEEK_LABEL_LOCALE, { month: "short" }).format(weekStart).replace(".", "");
  const endMonth = new Intl.DateTimeFormat(WEEK_LABEL_LOCALE, { month: "short" }).format(weekEnd).replace(".", "");
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
  const range = sameMonth
    ? `${weekStart.getDate()} — ${weekEnd.getDate()} ${endMonth}`
    : `${weekStart.getDate()} ${startMonth} — ${weekEnd.getDate()} ${endMonth}`;
  return { range, year: weekEnd.getFullYear() };
}

export function formatHourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** Minutos desde 00:00 do dia. */
export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}
