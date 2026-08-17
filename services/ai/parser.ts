import OpenAI from "openai";
import { z } from "zod";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { addDays, addMinutes } from "date-fns";
import { ParsedTaskResult, TaskIntent } from "@/types";

const parsedTaskSchema = z.object({
  intent: z.enum([
    "create_task",
    "complete_task",
    "uncomplete_task",
    "delete_task",
    "edit_title",
    "set_deadline",
    "remove_deadline",
  ]),
  targetQuery: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
});

/**
 * Cleans the search query from leading prepositions and noise words.
 */
export function cleanTargetQuery(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let cleaned = raw
    .replace(/^(?:на|у|про|о|об|в|по|для|с|со|задачу|задача|дело)\s+/giu, "")
    .replace(/\s+(?:в\s+работу|выполненн[а-я]*|сделан[а-я]*|обратно|готов[а-я]*)$/giu, "")
    .replace(/^[–—\-:\s,]+|[–—\-:\s,]+$/g, "")
    .trim();
  return cleaned.length >= 2 ? cleaned : null;
}

/**
 * Parses user natural language input (Russian or English) and extracts structured intent, task title, and deadline.
 */
export async function parseTaskInput(params: {
  input: string;
  anchorDate?: Date;
  timezone?: string;
}): Promise<ParsedTaskResult> {
  const { input, anchorDate = new Date(), timezone = "Europe/Chisinau" } = params;
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error("Входящее сообщение пустое");
  }

  const apiKey = process.env.OPENAI_API_KEY;

  // Try OpenAI GPT parser if key is provided and not a placeholder
  if (apiKey && !apiKey.includes("placeholder")) {
    try {
      const currentFormatted = formatInTimeZone(
        anchorDate,
        timezone,
        "yyyy-MM-dd HH:mm:ss (EEEE, zzz)"
      );

      const openai = new OpenAI({ apiKey });

      const systemPrompt = `
You are the AI Intent & Task Engine for "Delo", an intelligent minimalist task manager.
Current user wall-clock time: ${currentFormatted} in timezone ${timezone}.

CRITICAL INTENT RULES:
1. DEFAULT TO "create_task":
   - Any message stating an action to do (e.g., "Отправить отчет Мари Ванне до 15:23 до вторника", "Купить молоко", "Через 2 часа проверить рабочую почту", "Завтра в три часа созвониться с юристом", "До 25 августа сдать проект", "До 25 августа подготовить документы") is ALWAYS "create_task".
   - The presence of deadlines (e.g., "до 25 августа", "через 2 часа", "до 15:23", "до вторника", "завтра") in a task description does NOT mean set_deadline. It is a "create_task" WITH a deadline.

2. ONLY use other intents if the user explicitly gives a management command on an existing task:
   - "set_deadline": ONLY if user explicitly commands to postpone/move/set deadline (e.g., "Перенеси задачу отчета на послезавтра", "Сдвинь дедлайн статьи на завтра 18:00", "Поставь дедлайн задаче отчет на пятницу").
   - "remove_deadline": ONLY if user explicitly commands to remove deadline (e.g., "Убери дедлайн у задачи отчет", "Сделай задачу созвон без дедлайна").
   - "complete_task": ONLY if user explicitly commands to complete (e.g., "Поставь галочку на задаче купить хлеб", "Пометь отчет выполненным", "Я сделал созвон").
   - "uncomplete_task": ONLY if user explicitly commands to uncheck/reactivate (e.g., "Верни задачу купить хлеб в работу", "Сними галочку с задачи").
   - "delete_task": ONLY if user explicitly commands to delete (e.g., "Удали задачу проверить почту", "Вычеркни молоко").
   - "edit_title": ONLY if user explicitly commands to rename (e.g., "Измени задачу 'купить хлеб' на 'купить багет'").

3. DEADLINE & TIME RESOLUTION RULES (RUSSIAN SEMANTICS):
   - Calculate deadline in user's LOCAL wall-clock time format: "YYYY-MM-DD HH:mm:ss".
   - CRITICAL WEEKDAYS: Always choose the CLOSEST UPCOMING occurrence of the weekday from ${currentFormatted}.
     * If today is Monday (Aug 17), "во вторник" / "до вторника" is ALWAYS TOMORROW (Tuesday, Aug 18). Never skip to next week unless the user explicitly says "в следующий вторник".
   - "до [Дата/Число]" (e.g., "до 25 августа", "до 1 сентября") WITHOUT exact hour means BEFORE that date arrives, so deadline is the PRECEDING day at 23:59:00 (e.g. "до 25 августа" -> "2026-08-24 23:59:00").
   - "до [День недели]" (e.g., "до вторника") WITHOUT exact hour means BEFORE that weekday arrives, so deadline is the preceding day at 23:59:00.
   - If exact time is stated with "до" (e.g., "до 15:23 до вторника"), use that exact hour on the closest occurrence of that day (e.g., Tuesday Aug 18 at 15:23:00).
   - "в [День недели]" (e.g., "во вторник", "в пятницу") without exact hour -> that day at 18:00:00.
   - "[Дата/Число]" without "до" (e.g., "25 августа подготовить документы") -> "2026-08-25 18:00:00".
   - "послезавтра" without hour -> anchorDate + 2 days at 18:00:00.
   - "завтра" without hour -> anchorDate + 1 day at 18:00:00.
   - "через X часов/минут" -> anchorDate + X (exact calculated hour and minute).
   - If no deadline or intent is "remove_deadline", return null.
   - NEVER copy current time's random minutes/hours unless calculating relative offset "через X".

4. FIELDS TO RETURN:
   - "intent": "create_task" | "complete_task" | "uncomplete_task" | "delete_task" | "edit_title" | "set_deadline" | "remove_deadline"
   - "targetQuery": The keyword identifying the existing task to find (e.g. "отчет", "купить хлеб", "проверить почту"). For "create_task", return null.
   - "title": Clean capitalized task title without date/time and filler words for "create_task" or new title for "edit_title". Otherwise null.
   - "deadline": Local wall-clock timestamp string "YYYY-MM-DD HH:mm:ss" or null.

Return strictly valid JSON:
{
  "intent": "create_task" | "complete_task" | "uncomplete_task" | "delete_task" | "edit_title" | "set_deadline" | "remove_deadline",
  "targetQuery": string | null,
  "title": string | null,
  "deadline": string | null
}
`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: trimmed },
        ],
        response_format: { type: "json_object" },
        temperature: 0.0,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsedJson = JSON.parse(content);
        const validated = parsedTaskSchema.parse(parsedJson);

        let finalDeadlineIso: string | null = null;
        if (validated.deadline && validated.intent !== "remove_deadline") {
          const raw = validated.deadline.trim();
          if (raw.includes("T") || raw.endsWith("Z")) {
            const cleanStr = raw.replace("T", " ").replace("Z", "").slice(0, 19);
            const utcDate = fromZonedTime(cleanStr, timezone);
            finalDeadlineIso = utcDate.toISOString();
          } else if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(?::\d{2})?$/.test(raw)) {
            const fullStr = raw.length === 16 ? `${raw}:00` : raw;
            const utcDate = fromZonedTime(fullStr, timezone);
            finalDeadlineIso = utcDate.toISOString();
          } else {
            finalDeadlineIso = new Date(raw).toISOString();
          }
        }

        return {
          intent: validated.intent,
          targetQuery: cleanTargetQuery(validated.targetQuery),
          title: validated.title?.trim() || (validated.intent === "create_task" ? trimmed : null),
          deadline: finalDeadlineIso,
        };
      }
    } catch (error) {
      console.warn("OpenAI API call error, falling back to deterministic intent parser:", error);
    }
  }

  // Universal offline rule-based parser
  return fallbackParser(trimmed, anchorDate, timezone);
}

/**
 * Universal deterministic parser for intent classification, target query extraction, and date/time calculation.
 */
export function fallbackParser(
  input: string,
  anchorDate: Date = new Date(),
  timezone: string = "Europe/Chisinau"
): ParsedTaskResult {
  const lower = input.toLowerCase().trim();

  // 1. Detect Intent
  let intent: TaskIntent = "create_task";

  if (
    /(?:^|[^\p{L}\d])(?:пометь|отметь|закрой|поставь\s+галочку|сделал|выполнил)(?:\s+(?:задачу|как|была|уже))?/iu.test(lower) &&
    /выполненн|сделан|готов|галочк/iu.test(lower)
  ) {
    intent = "complete_task";
  } else if (
    /(?:^|[^\p{L}\d])(?:верни|сними\s+галочку|не\s+выполнен|отмени\s+выполнение)(?:\s+(?:задачу|обратно|в\s+работу))?/iu.test(lower)
  ) {
    intent = "uncomplete_task";
  } else if (
    /(?:^|[^\p{L}\d])(?:удали|сотри|вычеркни|убери\s+задачу)(?:\s+задачу)?/iu.test(lower)
  ) {
    intent = "delete_task";
  } else if (
    /(?:^|[^\p{L}\d])(?:убери\s+дедлайн|без\s+дедлайна|сними\s+дедлайн|удали\s+дедлайн|сбрось\s+дедлайн)/iu.test(lower)
  ) {
    intent = "remove_deadline";
  } else if (
    /(?:^|[^\p{L}\d])(?:перенеси|сдвинь|поставь\s+дедлайн|измени\s+дедлайн|передвинь)/iu.test(lower)
  ) {
    intent = "set_deadline";
  } else if (
    /(?:^|[^\p{L}\d])(?:переименуй|измени\s+название|поменяй\s+название)(?:\s+задачи)?/iu.test(lower)
  ) {
    intent = "edit_title";
  }

  // 2. Date & Time Parsing
  let targetDate: Date | null = null;
  let targetHour: number | null = null;
  let targetMinute: number | null = null;
  let isDirectRelativeOffset = false;
  let hasDoPreposition = false;
  const matchedSpans: string[] = [];

  // Offset ("через 2 часа", "через 30 минут", "через 3 дня")
  const offsetHourMatch = lower.match(/(?:^|[^\p{L}\d])(через\s+(\d+|полтора|один|два|три|четыре|пять)\s*(?:часа|часов|час|ч))(?:[^\p{L}\d]|$)/iu);
  const offsetMinMatch = lower.match(/(?:^|[^\p{L}\d])(через\s+(\d+|полчаса|двадцать|тридцать|сорок|пятьдесят)\s*(?:минут|минуты|минуту|мин))(?:[^\p{L}\d]|$)/iu);
  const offsetDayMatch = lower.match(/(?:^|[^\p{L}\d])(через\s+(\d+|один|два|три|четыре|неделю|недели)\s*(?:день|дня|дней|нед))(?:[^\p{L}\d]|$)/iu);

  if (offsetHourMatch) {
    const wordMap: Record<string, number> = { один: 1, полтора: 1.5, два: 2, три: 3, четыре: 4, пять: 5 };
    const hours = wordMap[offsetHourMatch[2]] || parseFloat(offsetHourMatch[2]) || 1;
    targetDate = addMinutes(anchorDate, Math.round(hours * 60));
    isDirectRelativeOffset = true;
    matchedSpans.push(offsetHourMatch[1]);
  } else if (offsetMinMatch) {
    const wordMap: Record<string, number> = { полчаса: 30, двадцать: 20, тридцать: 30, сорок: 40, пятьдесят: 50 };
    const mins = wordMap[offsetMinMatch[2]] || parseInt(offsetMinMatch[2], 10) || 15;
    targetDate = addMinutes(anchorDate, mins);
    isDirectRelativeOffset = true;
    matchedSpans.push(offsetMinMatch[1]);
  } else if (offsetDayMatch) {
    const wordMap: Record<string, number> = { один: 1, два: 2, три: 3, четыре: 4, неделю: 7, недели: 14 };
    const days = wordMap[offsetDayMatch[2]] || parseInt(offsetDayMatch[2], 10) || 1;
    targetDate = addDays(anchorDate, days);
    matchedSpans.push(offsetDayMatch[1]);
  }

  // Month date: "25 августа", "до 25 августа"
  if (!targetDate) {
    const monthMatch = lower.match(/(?:^|[^\p{L}\d])((?:до|к|в|во|на)?\s*(\d{1,2})\s*(январ[яе]|феврал[яе]|март[ае]|апрел[яе]|ма[яе]|июн[яе]|июл[яе]|август[ае]|сентябр[яе]|октябр[яе]|ноябр[яе]|декабр[яе]))(?:[^\p{L}\d]|$)/iu);
    if (monthMatch) {
      const monthsPrefixes: Record<string, number> = {
        январ: 0, феврал: 1, март: 2, апрел: 3, ма: 4, июн: 5,
        июл: 6, август: 7, сентябр: 8, октябр: 9, ноябр: 10, декабр: 11
      };
      const day = parseInt(monthMatch[2], 10);
      const mPrefix = Object.keys(monthsPrefixes).find((k) => monthMatch[3].startsWith(k));
      if (mPrefix) {
        const monthIndex = monthsPrefixes[mPrefix];
        const currentYear = anchorDate.getFullYear();
        let dt = new Date(currentYear, monthIndex, day);
        if (dt.getTime() < anchorDate.getTime() - 86400000) {
          dt = new Date(currentYear + 1, monthIndex, day);
        }
        if (monthMatch[1]?.toLowerCase().startsWith("до") || monthMatch[1]?.toLowerCase().startsWith("к")) {
          hasDoPreposition = true;
        }
        targetDate = dt;
        matchedSpans.push(monthMatch[1]);
      }
    }
  }

  // Weekdays: "до вторника", "во вторник", "к пятнице"
  if (!targetDate) {
    const dowMatch = lower.match(/(?:^|[^\p{L}\d])((?:до|к|в|во|на)?\s*(?:следующ[а-я]*|будущ[а-я]*|эт[а-я]*)?\s*(понедельник[а-я]*|вторник[а-я]*|сред[а-я]*|четверг[а-я]*|пятниц[а-я]*|суббот[а-я]*|воскресень[а-я]*|пн|вт|ср|чт|пт|сб|вс))(?:[^\p{L}\d]|$)/iu);
    if (dowMatch) {
      const kw = dowMatch[2].toLowerCase();
      const dowMap: Record<string, number> = {
        пон: 1, пн: 1, вто: 2, вт: 2, сре: 3, ср: 3, чет: 4, чт: 4, пят: 5, пт: 5, суб: 6, сб: 6, вос: 0, вс: 0,
      };
      const prefix = Object.keys(dowMap).find((k) => kw.startsWith(k));
      if (prefix !== undefined) {
        const dayNum = dowMap[prefix];
        const currentDay = anchorDate.getDay();
        const diff = (dayNum - currentDay + 7) % 7 || 7;
        targetDate = addDays(anchorDate, diff);
        if (dowMatch[1]?.toLowerCase().startsWith("до") || dowMatch[1]?.toLowerCase().startsWith("к")) {
          hasDoPreposition = true;
        }
        matchedSpans.push(dowMatch[1]);
      }
    }
  }

  // Relative days: "послезавтра", "завтра", "сегодня"
  if (!targetDate) {
    const dayMatch = lower.match(/(?:^|[^\p{L}\d])((?:до|к|на)?\s*(послезавтра|завтра|сегодня))(?:[^\p{L}\d]|$)/iu);
    if (dayMatch) {
      const kw = dayMatch[2].toLowerCase();
      if (kw === "послезавтра") targetDate = addDays(anchorDate, 2);
      else if (kw === "завтра") targetDate = addDays(anchorDate, 1);
      else if (kw === "сегодня") targetDate = new Date(anchorDate);
      matchedSpans.push(dayMatch[1]);
    }
  }

  // Exact time: 15:23, 20:00, до 15:23, в 18:30
  const timeDigitsMatch = lower.match(/(?:^|[^\p{L}\d])((?:в|во|до|к|около|на)?\s*(\d{1,2})[:.](\d{2}))(?:[^\p{L}\d]|$)/iu);
  if (timeDigitsMatch) {
    targetHour = parseInt(timeDigitsMatch[2], 10);
    targetMinute = parseInt(timeDigitsMatch[3], 10);
    matchedSpans.push(timeDigitsMatch[1]);
  }

  // Word hours: "в три часа дня", "в 8 вечера"
  if (targetHour === null) {
    const timeWordMatch = lower.match(/(?:^|[^\p{L}\d])((?:в|во|до|к|около)?\s*(один|два|три|четыре|пять|шесть|семь|восемь|девять|десять|одиннадцать|двенадцать|\d{1,2})\s*(?:часа|часов|час)?\s*(дня|вечера|утра|ночи)?)(?:[^\p{L}\d]|$)/iu);
    if (timeWordMatch && (timeWordMatch[3] || lower.includes("часа") || lower.includes("часов") || lower.includes("дня"))) {
      const words: Record<string, number> = {
        один: 1, два: 2, три: 3, четыре: 4, пять: 5, шесть: 6,
        семь: 7, восемь: 8, девять: 9, десять: 10, одиннадцать: 11, двенадцать: 12
      };
      let h = words[timeWordMatch[2].toLowerCase()] || parseInt(timeWordMatch[2], 10);
      const period = (timeWordMatch[3] || "").toLowerCase();
      if ((period === "дня" || period === "вечера" || lower.includes("дня")) && h < 12) h += 12;
      if (period === "ночи" && h === 12) h = 0;
      targetHour = h;
      targetMinute = 0;
      matchedSpans.push(timeWordMatch[1]);
    }
  }

  // Short hour: "до 20", "в 18"
  if (targetHour === null) {
    const shortHourMatch = lower.match(/(?:^|[^\p{L}\d])((?:в|до|к)\s+(\d{1,2}))(?:[^\p{L}\d]|$)/iu);
    if (shortHourMatch) {
      const h = parseInt(shortHourMatch[2], 10);
      if (h >= 0 && h <= 23) {
        targetHour = h;
        targetMinute = 0;
        matchedSpans.push(shortHourMatch[1]);
      }
    }
  }

  // Named times: "к обеду", "до вечера", "утром"
  if (targetHour === null) {
    const namedMatch = lower.match(/(?:^|[^\p{L}\d])((?:к|до|в)?\s*(?:обед[ау]?|вечер(?:у|ом|а)?|утром|конц[ау]\s*дня))(?:[^\p{L}\d]|$)/iu);
    if (namedMatch) {
      const kw = namedMatch[1].toLowerCase();
      if (kw.includes("обед")) { targetHour = 13; targetMinute = 0; }
      else if (kw.includes("вечер")) { targetHour = 19; targetMinute = 0; }
      else if (kw.includes("утр")) { targetHour = 9; targetMinute = 0; }
      else if (kw.includes("конц")) { targetHour = 23; targetMinute = 59; }
      matchedSpans.push(namedMatch[1]);
    }
  }

  // Default hour to user timezone if time was given without date
  if (targetHour !== null && !targetDate) {
    targetDate = new Date(anchorDate);
    const currentHourInUserTz = parseInt(formatInTimeZone(anchorDate, timezone, "HH"), 10);
    if (targetHour < currentHourInUserTz) {
      targetDate = addDays(anchorDate, 1);
    }
  }

  let deadline: string | null = null;
  if (targetDate && intent !== "remove_deadline") {
    if (isDirectRelativeOffset) {
      deadline = targetDate.toISOString();
    } else {
      // If "до [Дата]" without explicit hour was used: deadline is PRECEDING day at 23:59:00
      let finalDate = targetDate;
      let finalHour = 18;
      let finalMinute = 0;

      if (hasDoPreposition && targetHour === null) {
        finalDate = addDays(targetDate, -1);
        finalHour = 23;
        finalMinute = 59;
      } else if (targetHour !== null) {
        finalHour = targetHour;
        finalMinute = targetMinute !== null ? targetMinute : 0;
      }

      const dateStr = formatInTimeZone(finalDate, timezone, "yyyy-MM-dd");
      const hourStr = String(finalHour).padStart(2, "0");
      const minStr = String(finalMinute).padStart(2, "0");

      const localDateTimeStr = `${dateStr} ${hourStr}:${minStr}:00`;
      const utcDate = fromZonedTime(localDateTimeStr, timezone);
      deadline = utcDate.toISOString();
    }
  }

  // 3. Extract Target Query and Clean Title
  let cleanText = input;

  // Remove matched date/time spans
  for (const span of matchedSpans) {
    const escaped = span.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    cleanText = cleanText.replace(new RegExp(`(?:^|[^\\p{L}\\d])(${escaped})(?:[^\\p{L}\\d]|$)`, "giu"), " ");
  }

  // Remove command prefixes for intent extraction
  cleanText = cleanText
    .replace(/(?:^|[^\p{L}\d])(пометь(те)?|отметь(те)?|закрой(те)?|поставь(те)?\s+галочку|сними(те)?\s+галочку|верни(те)?|удали(ть)?|сотри(те)?|вычеркни(те)?|убери(те)?|перенеси(те)?|сдвинь(те)?|измени(те)?|поменяй(те)?|переименуй(те)?|добавь(те)?)(?:\s+(?:задачу|как|обратно|в\s+работу|название|текст|дедлайн|срок))?/giu, " ")
    .replace(/(?:^|[^\p{L}\d])(выполненн[а-я]*|сделан[а-я]*|готов[а-я]*|дедлайн[а-я]*|задач[а-я]*)(?:[^\p{L}\d]|$)/giu, " ")
    .replace(/(?:^|[^\p{L}\d])(напомни(ть)?|надо бы|надо|нужно|пожалуйста|срочно|так|блин|слушай|плиз|быстро|не забудь(те)?)(?:[^\p{L}\d]|$)/giu, " ")
    .replace(/\s+/g, " ")
    .replace(/^[–—\-:\s,]+|[–—\-:\s,]+$/g, "")
    .trim();

  // Verb normalization for creation
  cleanText = cleanText
    .replace(/^позвони\b/iu, "Позвонить")
    .replace(/^напиши\b/iu, "Написать")
    .replace(/^отправь\b/iu, "Отправить")
    .replace(/^допиши\b/iu, "Дописать")
    .replace(/^купи\b/iu, "Купить")
    .replace(/^сделай\b/iu, "Сделать")
    .replace(/^проверь\b/iu, "Проверить");

  if (!cleanText || cleanText.length < 2) {
    cleanText = input.trim();
  }

  const capitalized = cleanText.charAt(0).toUpperCase() + cleanText.slice(1);

  return {
    intent,
    targetQuery: intent === "create_task" ? null : cleanTargetQuery(cleanText),
    title: intent === "create_task" || intent === "edit_title" ? capitalized : null,
    deadline,
  };
}
