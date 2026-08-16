import { format, isToday, isTomorrow, isPast, parseISO, isValid } from "date-fns";
import { ru } from "date-fns/locale";

/**
 * Formats a deadline timestamp into a user-friendly Russian string.
 * Example outputs:
 * - "Сегодня · 15:00"
 * - "Завтра · 10:30"
 * - "21 августа · 17:00"
 * - "21 августа 2026 · 17:00"
 * - "Без дедлайна"
 */
export function formatDeadline(dateString: string | null | undefined): string {
  if (!dateString) return "Без дедлайна";

  const date = typeof dateString === "string" ? parseISO(dateString) : new Date(dateString);
  if (!isValid(date)) return "Без дедлайна";

  const timePart = format(date, "HH:mm");

  if (isToday(date)) {
    return `Сегодня · ${timePart}`;
  }

  if (isTomorrow(date)) {
    return `Завтра · ${timePart}`;
  }

  const currentYear = new Date().getFullYear();
  const dateYear = date.getFullYear();

  if (currentYear === dateYear) {
    const dayMonth = format(date, "d MMMM", { locale: ru });
    return `${dayMonth} · ${timePart}`;
  }

  const fullDate = format(date, "d MMMM yyyy", { locale: ru });
  return `${fullDate} · ${timePart}`;
}

/**
 * Checks if a deadline timestamp is overdue.
 */
export function isOverdue(dateString: string | null | undefined, completed = false): boolean {
  if (!dateString || completed) return false;
  const date = typeof dateString === "string" ? parseISO(dateString) : new Date(dateString);
  if (!isValid(date)) return false;
  return isPast(date);
}
