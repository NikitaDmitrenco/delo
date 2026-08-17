import OpenAI from "openai";
import { z } from "zod";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { addDays, addMinutes } from "date-fns";
import { ParsedTaskResult } from "@/types";

const parsedTaskSchema = z.object({
  title: z.string().min(1),
  deadline: z.string().nullable(),
});

/**
 * Parses user natural language input (Russian or English) and extracts structured task title and deadline.
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
You are the AI task extraction engine for "Delo", an intelligent minimalist task manager.
Your role is to extract:
1. "title": The clean, concise task description in Russian.
   - Strip out ALL date and time expressions from the title completely (e.g. "отправить Отчет Мари Ванне до 15:23 до вторника" -> "Отправить Отчет Мари Ванне", "Сегодня до 20:00 дописать статью" -> "Дописать статью").
   - Strip conversational filler ("так", "блин", "надо бы", "надо", "слушай", "пожалуйста", "напомни", "срочно").
   - Keep proper nouns, names, and objects intact (e.g. "Мари Ванне", "договор с ИП Иванов").
   - Capitalize the first letter.
2. "deadline": The exact ISO-8601 UTC timestamp of the deadline, OR null.
   
CRITICAL RULES FOR DEADLINE:
- Current user reference time: ${currentFormatted} in timezone: ${timezone}.
- Calculate relative dates ("сегодня", "завтра", "послезавтра", "во вторник", "до вторника", "в пятницу", "через 2 часа", "до 15:23" -> 15:23 on target day) using the user's timezone (${timezone}), then convert to ISO-8601 UTC string.
- NEVER INVENT A DEADLINE. If the user did not specify or clearly imply a deadline (e.g. "Позвонить маме", "Купить молоко"), return null for deadline.

Return strictly JSON:
{
  "title": string,
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
          title: validated.title.trim(),
          deadline: validated.deadline,
        };
      }
    } catch (error) {
      console.warn("OpenAI API call error (quota or network), falling back to universal NLP rule parser:", error);
    }
  }

  // Universal offline rule-based parser
  return fallbackParser(trimmed, anchorDate, timezone);
}

/**
 * Universal Russian natural language date & time task parser with full grammatical declension support.
 */
export function fallbackParser(
  input: string,
  anchorDate: Date = new Date(),
  timezone: string = "Europe/Chisinau"
): ParsedTaskResult {
  const lower = input.toLowerCase();

  let targetDate: Date | null = null;
  let targetHour: number | null = null;
  let targetMinute: number | null = null;
  const matchedSpans: string[] = [];

  // 1. Relative offset ("через 2 часа", "через 30 минут", "через 3 дня")
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

  // 2. Calendar Month Date: "25 августа", "до 15 сентября", "к 1 мая"
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

  // 3. Weekdays with all Russian grammatical cases (до вторника, во вторник, к пятнице, в след. четверг)
  if (!targetDate) {
    const dowMatch = lower.match(/(?:^|[^\p{L}\d])((?:до|к|в|во|на)?\s*(?:следующ[а-я]*|будущ[а-я]*|эт[а-я]*)?\s*(понедельник[а-я]*|вторник[а-я]*|сред[а-я]*|четверг[а-я]*|пятниц[а-я]*|суббот[а-я]*|воскресень[а-я]*|пн|вт|ср|чт|пт|сб|вс))(?:[^\p{L}\d]|$)/iu);
    if (dowMatch) {
      const kw = dowMatch[2].toLowerCase();
      const dowMap: Record<string, number> = {
        пон: 1, пн: 1,
        вто: 2, вт: 2,
        сре: 3, ср: 3,
        чет: 4, чт: 4,
        пят: 5, пт: 5,
        суб: 6, сб: 6,
        вос: 0, вс: 0,
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

  // 4. Relative days: "послезавтра", "завтра", "сегодня"
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

  // 5. Exact time parsing
  // 5a. Format: 15:23, 20:00, 15.30, до 15:23, к 20:00, в 18:30
  const timeDigitsMatch = lower.match(/(?:^|[^\p{L}\d])((?:в|во|до|к|около|на)?\s*(\d{1,2})[:.](\d{2}))(?:[^\p{L}\d]|$)/iu);
  if (timeDigitsMatch) {
    targetHour = parseInt(timeDigitsMatch[2], 10);
    targetMinute = parseInt(timeDigitsMatch[3], 10);
    matchedSpans.push(timeDigitsMatch[1]);
  }

  // 5b. Format: "в три часа дня", "в 3 часа дня", "в 8 вечера", "в 9 утра"
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

  // 5c. Format: "до 20", "в 18", "к 17"
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

  // 5d. Named times: "к обеду", "до вечера", "утром", "до конца дня"
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

  // If time was given without explicit date, default to today (or tomorrow if already passed in user timezone)
  if (targetHour !== null && !targetDate) {
    targetDate = new Date(anchorDate);
    const currentHourInUserTz = parseInt(formatInTimeZone(anchorDate, timezone, "HH"), 10);
    if (targetHour < currentHourInUserTz) {
      targetDate = addDays(anchorDate, 1);
    }
  }

  // Construct ISO deadline strictly in user's timezone
  let deadline: string | null = null;
  if (targetDate) {
    const finalHour = targetHour !== null ? targetHour : 18;
    const finalMinute = targetMinute !== null ? targetMinute : 0;

    const dateStr = formatInTimeZone(targetDate, timezone, "yyyy-MM-dd");
    const hourStr = String(finalHour).padStart(2, "0");
    const minStr = String(finalMinute).padStart(2, "0");

    const localDateTimeStr = `${dateStr} ${hourStr}:${minStr}:00`;
    const utcDate = fromZonedTime(localDateTimeStr, timezone);
    deadline = utcDate.toISOString();
  }

  // 6. Clean task title: remove all matched date/time phrases
  let cleanTitle = input;

  for (const span of matchedSpans) {
    const escaped = span.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    cleanTitle = cleanTitle.replace(new RegExp(`(?:^|[^\\p{L}\\d])(${escaped})(?:[^\\p{L}\\d]|$)`, "giu"), " ");
  }

  // Remove filler words & orphaned time prepositions
  cleanTitle = cleanTitle
    .replace(/(?:^|[^\p{L}\d])(напомни(ть)?|надо бы|надо|нужно|пожалуйста|срочно|так|блин|слушай|плиз|быстро|не забудь(те)?)(?:[^\p{L}\d]|$)/giu, " ")
    .replace(/\s+/g, " ")
    .replace(/^[–—\-:\s,]+|[–—\-:\s,]+$/g, "")
    .trim();

  // Verb normalization for leading imperative verbs
  cleanTitle = cleanTitle
    .replace(/^позвони\b/iu, "Позвонить")
    .replace(/^напиши\b/iu, "Написать")
    .replace(/^отправь\b/iu, "Отправить")
    .replace(/^допиши\b/iu, "Дописать")
    .replace(/^купи\b/iu, "Купить")
    .replace(/^сделай\b/iu, "Сделать")
    .replace(/^проверь\b/iu, "Проверить");

  if (!cleanTitle || cleanTitle.length < 2) {
    cleanTitle = input.trim();
  }

  cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);

  return {
    title: cleanTitle,
    deadline,
  };
}
