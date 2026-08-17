import { parseISO, isValid, addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { ru } from "date-fns/locale";

/**
 * Formats a deadline timestamp into a user-friendly Russian string respecting user timezone.
 * Example outputs:
 * - "Сегодня · 15:00"
 * - "Завтра · 10:30"
 * - "21 августа · 17:00"
 * - "21 августа 2026 · 17:00"
 * - "Без дедлайна"
 */
export function formatDeadline(
  dateString: string | null | undefined,
  timezone?: string
): string {
  if (!dateString) return "Без дедлайна";

  const date = typeof dateString === "string" ? parseISO(dateString) : new Date(dateString);
  if (!isValid(date)) return "Без дедлайна";

  // Determine active timezone
  let tz = timezone;
  if (!tz) {
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      tz = "Europe/Chisinau";
    }
  }
  if (!tz) tz = "Europe/Chisinau";

  const timePart = formatInTimeZone(date, tz, "HH:mm");
  const formattedDayMonth = formatInTimeZone(date, tz, "d MMMM", { locale: ru });
  const formattedFull = formatInTimeZone(date, tz, "d MMMM yyyy", { locale: ru });

  const now = new Date();
  const todayStr = formatInTimeZone(now, tz, "yyyy-MM-dd");
  const targetDayStr = formatInTimeZone(date, tz, "yyyy-MM-dd");
  const tomorrowStr = formatInTimeZone(addDays(now, 1), tz, "yyyy-MM-dd");

  if (targetDayStr === todayStr) {
    return `Сегодня · ${timePart}`;
  }

  if (targetDayStr === tomorrowStr) {
    return `Завтра · ${timePart}`;
  }

  const currentYear = parseInt(formatInTimeZone(now, tz, "yyyy"), 10);
  const dateYear = parseInt(formatInTimeZone(date, tz, "yyyy"), 10);

  if (currentYear === dateYear) {
    return `${formattedDayMonth} · ${timePart}`;
  }

  return `${formattedFull} · ${timePart}`;
}

/**
 * Checks if a deadline timestamp is overdue.
 */
export function isOverdue(dateString: string | null | undefined, completed = false): boolean {
  if (!dateString || completed) return false;
  const date = typeof dateString === "string" ? parseISO(dateString) : new Date(dateString);
  if (!isValid(date)) return false;
  return date.getTime() < Date.now();
}
