import { addMinutes } from "date-fns";

/**
 * Calculates the exact timestamp for sending a reminder based on:
 * remind_at = deadline - (estimated_duration + buffer_minutes)
 */
export function calculateRemindAt(
  deadlineIso: string | null | undefined,
  estimatedDurationMinutes: number = 30,
  reminderBufferMinutes: number = 20,
  now: Date = new Date()
): string | null {
  if (!deadlineIso) return null;

  const deadline = new Date(deadlineIso);
  if (isNaN(deadline.getTime())) return null;

  const totalOffsetMinutes = Math.max(1, estimatedDurationMinutes + reminderBufferMinutes);
  const calculatedRemindAt = addMinutes(deadline, -totalOffsetMinutes);

  // If deadline is already in the past, no reminder
  if (deadline.getTime() <= now.getTime()) {
    return null;
  }

  // If calculated time is already in the past, schedule reminder for right now (+1 min)
  if (calculatedRemindAt.getTime() <= now.getTime()) {
    return addMinutes(now, 1).toISOString();
  }

  return calculatedRemindAt.toISOString();
}

/**
 * Deterministic heuristic estimation of task duration in minutes.
 */
export function estimateDefaultDuration(title: string): number {
  if (!title) return 30;
  const lower = title.toLowerCase();

  // Quick tasks (15–30 mins)
  if (/(?:позвонить|набрать|отправить\s+смс|оплатить|купить\s+хлеб|перевести|заказать|напомнить)/iu.test(lower)) {
    return 15;
  }

  // Large tasks (120–240 mins)
  if (/(?:диплом|курсов|проект|отчет|презентаци|ремонт|генеральн|налоговой|договор|стать)/iu.test(lower)) {
    return 120;
  }

  // Medium tasks (45–60 mins)
  if (/(?:купить|магазин|тренировк|уборк|созвон|встреч|документ|подготовить)/iu.test(lower)) {
    return 60;
  }

  return 30;
}
