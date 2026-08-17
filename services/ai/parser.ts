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
Your role is to classify the user's intent and extract structured data:

1. "intent": One of:
   - "create_task": User wants to add a new task (e.g., "Завтра в 15:00 созвон", "Добавь задачу купить хлеб").
   - "complete_task": User wants to mark an existing task as completed (e.g., "Пометь задачу отчет Мари Ванне выполненной", "Поставь галочку на задаче купить хлеб", "Сделал статью").
   - "uncomplete_task": User wants to uncheck / reactivate a task (e.g., "Верни отчет в работу", "Сними галочку с задачи").
   - "delete_task": User wants to delete a task (e.g., "Удали задачу про юриста", "Вычеркни молоко").
   - "edit_title": User wants to rename or edit the text of a task (e.g., "Измени задачу 'купить хлеб' на 'купить багет и сыр'").
   - "set_deadline": User wants to set, change, or postpone the deadline of an existing task (e.g., "Перенеси задачу отчета на послезавтра", "Поставь дедлайн задаче отчет на пятницу в 18:00").
   - "remove_deadline": User wants to remove the deadline from a task (e.g., "Убери дедлайн у задачи созвон", "Сделай задачу без дедлайна").

2. "targetQuery": For non-create intents ("complete_task", "uncomplete_task", "delete_task", "edit_title", "set_deadline", "remove_deadline"), extract the concise keyword/phrase identifying which existing task to find in the database (e.g., "отчет", "купить хлеб", "созвон с юристом"). For "create_task", return null.

3. "title": 
   - For "create_task": The clean task title with all date/time and filler words removed, capitalized (e.g., "Дописать статью").
   - For "edit_title": The new title to apply.
   - For other intents: null.

4. "deadline": The exact ISO-8601 UTC timestamp of the deadline, OR null.
   - Calculate relative dates ("сегодня", "завтра", "послезавтра" -> anchorDate + 2 days, "в пятницу", "в понедельник", "через 2 часа", "до 15:23") using the user's reference time and timezone: ${currentFormatted}, ${timezone}.
   - If intent is "remove_deadline" or no deadline was specified/implied, return null.

Return strictly JSON:
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
        temperature: 0.1,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsedJson = JSON.parse(content);
        const validated = parsedTaskSchema.parse(parsedJson);

        return {
          intent: validated.intent,
          targetQuery: validated.targetQuery || null,
          title: validated.title?.trim() || trimmed,
          deadline: validated.deadline || null,
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
  let strippedCommand = lower;

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
    /(?:^|[^\p{L}\d])(?:перенеси\s+дедлайн|поставь\s+дедлайн|сдвинь\s+дедлайн|измени\s+дедлайн|перенеси\s+задачу|перенеси\s+на|сдвинь\s+на)/iu.test(lower)
  ) {
    intent = "set_deadline";
  } else if (
    /(?:^|[^\p{L}\d])(?:переименуй|измени\s+название|поменяй\s+название|измени\s+текст)(?:\s+задачи)?/iu.test(lower)
  ) {
    intent = "edit_title";
  }

  // 2. Date & Time Parsing
  let targetDate: Date | null = null;
  let targetHour: number | null = null;
  let targetMinute: number | null = null;
  const matchedSpans: string[] = [];

  // Offset ("через 2 часа", "через 30 минут", "через 3 дня")
  const offsetHourMatch = lower.match(/(?:^|[^\p{L}\d])(через\s+(\d+|полтора|один|два|три|четыре|пять)\s*(?:часа|часов|час|ч))(?:[^\p{L}\d]|$)/iu);
  const offsetMinMatch = lower.match(/(?:^|[^\p{L}\d])(через\s+(\d+|полчаса|двадцать|тридцать|сорок|пятьдесят)\s*(?:минут|минуты|минуту|мин))(?:[^\p{L}\d]|$)/iu);
  const offsetDayMatch = lower.match(/(?:^|[^\p{L}\d])(через\s+(\d+|один|два|три|четыре|неделю|недели)\s*(?:день|дня|дней|нед))(?:[^\p{L}\d]|$)/iu);

  if (offsetHourMatch) {
    const wordMap: Record<string, number> = { один: 1, полтора: 1.5, два: 2, три: 3, четыре: 4, пять: 5 };
    const hours = wordMap[offsetHourMatch[2]] || parseFloat(offsetHourMatch[2]) || 1;
    targetDate = addMinutes(anchorDate, Math.round(hours * 60));
    matchedSpans.push(offsetHourMatch[1]);
  } else if (offsetMinMatch) {
    const wordMap: Record<string, number> = { полчаса: 30, двадцать: 20, тридцать: 30, сорок: 40, пятьдесят: 50 };
    const mins = wordMap[offsetMinMatch[2]] || parseInt(offsetMinMatch[2], 10) || 15;
    targetDate = addMinutes(anchorDate, mins);
    matchedSpans.push(offsetMinMatch[1]);
  } else if (offsetDayMatch) {
    const wordMap: Record<string, number> = { один: 1, два: 2, три: 3, четыре: 4, неделю: 7, недели: 14 };
    const days = wordMap[offsetDayMatch[2]] || parseInt(offsetDayMatch[2], 10) || 1;
    targetDate = addDays(anchorDate, days);
    matchedSpans.push(offsetDayMatch[1]);
  }

  // Month date: "25 августа", "до 15 сентября"
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
    const finalHour = targetHour !== null ? targetHour : 18;
    const finalMinute = targetMinute !== null ? targetMinute : 0;

    const dateStr = formatInTimeZone(targetDate, timezone, "yyyy-MM-dd");
    const hourStr = String(finalHour).padStart(2, "0");
    const minStr = String(finalMinute).padStart(2, "0");

    const localDateTimeStr = `${dateStr} ${hourStr}:${minStr}:00`;
    const utcDate = fromZonedTime(localDateTimeStr, timezone);
    deadline = utcDate.toISOString();
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
    .replace(/(?:^|[^\p{L}\d])(пометь(те)?|отметь(те)?|закрой(те)?|поставь(те)?\s+галочку|сними(те)?\s+галочку|верни(те)?|удали(ть)?|сотри(те)?|вычеркни(те)?|убери(те)?|перенеси(те)?|сдвинь(те)?|измени(те)?|поменяй(те)?|переименуй(те)?|добавь(те)?)(?:\s+(?:задачу|как|обратно|в\s+работу|название|текст|дедлайн))?/giu, " ")
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
    targetQuery: intent === "create_task" ? null : cleanText,
    title: intent === "create_task" || intent === "edit_title" ? capitalized : null,
    deadline,
  };
}
