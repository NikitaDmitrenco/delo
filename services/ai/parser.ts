import OpenAI from "openai";
import { z } from "zod";
import { formatInTimeZone } from "date-fns-tz";
import {
  addDays,
  addMinutes,
  setHours,
  setMinutes,
  setSeconds,
  setMilliseconds,
} from "date-fns";
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
   - Strip out date and time expressions from the title completely (e.g. "Сегодня до 20:00 дописать статью" -> "Дописать статью", "В пятницу в 18:00 сдать отчёт" -> "Сдать отчёт").
   - Strip conversational filler ("так", "блин", "надо бы", "надо", "слушай", "пожалуйста", "напомни", "срочно").
   - Capitalize the first letter.
2. "deadline": The exact ISO-8601 UTC timestamp of the deadline, OR null.
   
CRITICAL RULES FOR DEADLINE:
- Current user reference time: ${currentFormatted} in timezone: ${timezone}.
- Calculate relative dates ("сегодня", "завтра", "послезавтра", "в пятницу", "в понедельник", "через 2 часа", "до обеда" -> 12:00, "к вечеру" -> 18:00, "утром" -> 09:00, "до 20:00" -> 20:00) using the user's timezone, then convert to ISO-8601 UTC string.
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
      console.warn("OpenAI API call error (quota or network), falling back to Cyrillic NLP rule parser:", error);
    }
  }

  // Comprehensive Unicode Cyrillic rule-based parser
  return fallbackParser(trimmed, anchorDate, timezone);
}

/**
 * Unicode-aware Cyrillic boundary helpers
 */
const B_START = "(?<![а-яёa-z0-9])";
const B_END = "(?![а-яёa-z0-9])";

/**
 * Comprehensive deterministic parser for Russian natural language tasks.
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
  const offsetHourMatch = lower.match(new RegExp(`${B_START}через\\s+(\\d+|полтора|один|два|три|четыре|пять)\\s*(?:часа|часов|час|ч)${B_END}`, "iu"));
  const offsetMinMatch = lower.match(new RegExp(`${B_START}через\\s+(\\d+|полчаса|двадцать|тридцать|сорок|пятьдесят)\\s*(?:минут|минуты|минуту|мин)${B_END}`, "iu"));
  const offsetDayMatch = lower.match(new RegExp(`${B_START}через\\s+(\\d+|один|два|три|четыре|неделю|недели)\\s*(?:день|дня|дней|нед)${B_END}`, "iu"));

  if (offsetHourMatch) {
    const wordMap: Record<string, number> = { один: 1, полтора: 1.5, два: 2, три: 3, четыре: 4, пять: 5 };
    const hours = wordMap[offsetHourMatch[1]] || parseFloat(offsetHourMatch[1]) || 1;
    targetDate = addMinutes(anchorDate, Math.round(hours * 60));
    matchedSpans.push(offsetHourMatch[0]);
  } else if (offsetMinMatch) {
    const wordMap: Record<string, number> = { полчаса: 30, двадцать: 20, тридцать: 30, сорок: 40, пятьдесят: 50 };
    const mins = wordMap[offsetMinMatch[1]] || parseInt(offsetMinMatch[1], 10) || 15;
    targetDate = addMinutes(anchorDate, mins);
    matchedSpans.push(offsetMinMatch[0]);
  } else if (offsetDayMatch) {
    const wordMap: Record<string, number> = { один: 1, два: 2, три: 3, четыре: 4, неделю: 7, недели: 14 };
    const days = wordMap[offsetDayMatch[1]] || parseInt(offsetDayMatch[1], 10) || 1;
    targetDate = addDays(anchorDate, days);
    matchedSpans.push(offsetDayMatch[0]);
  }

  // 2. Relative day: послезавтра, завтра, сегодня
  if (!targetDate) {
    const dayMatch = lower.match(new RegExp(`${B_START}(послезавтра|завтра|сегодня)${B_END}`, "iu"));
    if (dayMatch) {
      const kw = dayMatch[1].toLowerCase();
      if (kw === "послезавтра") targetDate = addDays(anchorDate, 2);
      else if (kw === "завтра") targetDate = addDays(anchorDate, 1);
      else if (kw === "сегодня") targetDate = new Date(anchorDate);
      matchedSpans.push(dayMatch[0]);
    }
  }

  // 3. Days of the week (в пятницу, к понедельнику, в среду и т.д.)
  if (!targetDate) {
    const dowMatch = lower.match(new RegExp(`${B_START}(?:в|во|к|до)?\\s*(понедельник|вторник|среду|среда|четверг|пятницу|пятница|субботу|суббота|воскресенье)${B_END}`, "iu"));
    if (dowMatch) {
      const kw = dowMatch[1].toLowerCase();
      const dowMap: Record<string, number> = {
        понедельник: 1, вторник: 2, среду: 3, среда: 3, четверг: 4,
        пятницу: 5, пятница: 5, субботу: 6, суббота: 6, воскресенье: 0
      };
      const dayNum = dowMap[kw];
      if (dayNum !== undefined) {
        const currentDay = anchorDate.getDay();
        const diff = (dayNum - currentDay + 7) % 7 || 7;
        targetDate = addDays(anchorDate, diff);
        matchedSpans.push(dowMatch[0]);
      }
    }
  }

  // 4. Exact time parsing
  // 4a. Format: 20:00 / 15:30 / 20.00 / до 20:00 / в 15:00
  const timeDigitsMatch = lower.match(new RegExp(`${B_START}(?:в|до|к|около|на)?\\s*(\\d{1,2})[:.](\\d{2})${B_END}`, "iu"));
  if (timeDigitsMatch) {
    targetHour = parseInt(timeDigitsMatch[1], 10);
    targetMinute = parseInt(timeDigitsMatch[2], 10);
    matchedSpans.push(timeDigitsMatch[0]);
  }

  // 4b. Format: в три часа дня / в 3 часа дня / в два часа / в 8 вечера / в 9 утра
  if (targetHour === null) {
    const timeWordMatch = lower.match(new RegExp(`${B_START}(?:в|до|к|около)?\\s*(один|два|три|четыре|пять|шесть|семь|восемь|девять|десять|одиннадцать|двенадцать|\\d{1,2})\\s*(?:часа|часов|час)?\\s*(дня|вечера|утра|ночи)?${B_END}`, "iu"));
    if (timeWordMatch && (timeWordMatch[2] || lower.includes("часа") || lower.includes("часов") || lower.includes("дня"))) {
      const words: Record<string, number> = {
        один: 1, два: 2, три: 3, четыре: 4, пять: 5, шесть: 6,
        семь: 7, восемь: 8, девять: 9, десять: 10, одиннадцать: 11, двенадцать: 12
      };
      let h = words[timeWordMatch[1].toLowerCase()] || parseInt(timeWordMatch[1], 10);
      const period = (timeWordMatch[2] || "").toLowerCase();
      if ((period === "дня" || period === "вечера" || lower.includes("дня")) && h < 12) h += 12;
      if (period === "ночи" && h === 12) h = 0;
      targetHour = h;
      targetMinute = 0;
      matchedSpans.push(timeWordMatch[0]);
    }
  }

  // 4c. Format: "до 20" / "в 18" / "к 17"
  if (targetHour === null) {
    const shortHourMatch = lower.match(new RegExp(`${B_START}(?:в|до|к)\\s+(\\d{1,2})${B_END}`, "iu"));
    if (shortHourMatch) {
      const h = parseInt(shortHourMatch[1], 10);
      if (h >= 0 && h <= 23) {
        targetHour = h;
        targetMinute = 0;
        matchedSpans.push(shortHourMatch[0]);
      }
    }
  }

  // 4d. Named times: "к обеду", "до вечера", "утром", "до конца дня"
  if (targetHour === null) {
    if (new RegExp(`${B_START}(?:к|до|в)?\\s*обед[ау]?${B_END}`, "iu").test(lower)) {
      targetHour = 13; targetMinute = 0;
      matchedSpans.push(lower.match(new RegExp(`${B_START}(?:к|до|в)?\\s*обед[ау]?${B_END}`, "iu"))![0]);
    } else if (new RegExp(`${B_START}(?:к|до)?\\s*вечер(?:у|ом|а)${B_END}`, "iu").test(lower)) {
      targetHour = 19; targetMinute = 0;
      matchedSpans.push(lower.match(new RegExp(`${B_START}(?:к|до)?\\s*вечер(?:у|ом|а)${B_END}`, "iu"))![0]);
    } else if (new RegExp(`${B_START}утром${B_END}`, "iu").test(lower)) {
      targetHour = 9; targetMinute = 0;
      matchedSpans.push("утром");
    } else if (new RegExp(`${B_START}(?:до|к)\\s*конц[ау]\\s*дня${B_END}`, "iu").test(lower)) {
      targetHour = 23; targetMinute = 59;
      matchedSpans.push(lower.match(new RegExp(`${B_START}(?:до|к)\\s*конц[ау]\\s*дня${B_END}`, "iu"))![0]);
    }
  }

  // If time was given without explicit date, default to today (or tomorrow if passed)
  if (targetHour !== null && !targetDate) {
    targetDate = new Date(anchorDate);
    if (targetHour < anchorDate.getHours()) {
      targetDate = addDays(anchorDate, 1);
    }
  }

  // Construct ISO deadline
  let deadline: string | null = null;
  if (targetDate) {
    const finalHour = targetHour !== null ? targetHour : 18;
    const finalMinute = targetMinute !== null ? targetMinute : 0;
    const dt = setMilliseconds(setSeconds(setMinutes(setHours(targetDate, finalHour), finalMinute), 0), 0);
    deadline = dt.toISOString();
  }

  // 5. Clean task title
  let cleanTitle = input;

  // Remove matched date/time spans
  for (const span of matchedSpans) {
    const escaped = span.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    cleanTitle = cleanTitle.replace(new RegExp(`${B_START}${escaped}${B_END}`, "giu"), " ");
  }

  // Remove filler words & stray prepositions
  cleanTitle = cleanTitle
    .replace(new RegExp(`${B_START}(напомни(ть)?|надо бы|надо|нужно|пожалуйста|срочно|так|блин|слушай|плиз|быстро|не забудь(те)?)${B_END}`, "giu"), " ")
    .replace(new RegExp(`${B_START}(сегодня|завтра|послезавтра|в|во|до|к|на)${B_END}`, "giu"), " ")
    .replace(/[,\s]+/g, " ")
    .replace(/^[–—\-:\s]+|[–—\-:\s]+$/g, "")
    .trim();

  // Verb normalization
  cleanTitle = cleanTitle
    .replace(new RegExp(`${B_START}позвони${B_END}`, "giu"), "Позвонить")
    .replace(new RegExp(`${B_START}напиши${B_END}`, "giu"), "Написать")
    .replace(new RegExp(`${B_START}отправь${B_END}`, "giu"), "Отправить")
    .replace(new RegExp(`${B_START}допиши${B_END}`, "giu"), "Дописать")
    .replace(new RegExp(`${B_START}купи${B_END}`, "giu"), "Купить")
    .replace(new RegExp(`${B_START}сделай${B_END}`, "giu"), "Сделать")
    .replace(new RegExp(`${B_START}проверь${B_END}`, "giu"), "Проверить");

  if (!cleanTitle || cleanTitle.length < 2) {
    cleanTitle = input.trim();
  }

  cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);

  return {
    title: cleanTitle,
    deadline,
  };
}
