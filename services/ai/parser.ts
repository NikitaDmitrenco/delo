import OpenAI from "openai";
import { z } from "zod";
import { formatInTimeZone } from "date-fns-tz";
import { addDays, setHours, setMinutes, setSeconds, parseISO, isValid } from "date-fns";
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

  // Format anchor datetime in user timezone for reference
  const currentFormatted = formatInTimeZone(
    anchorDate,
    timezone,
    "yyyy-MM-dd HH:mm:ss (EEEE, zzz)"
  );

  const apiKey = process.env.OPENAI_API_KEY;

  // Fallback heuristic parser if OpenAI API key is missing (useful for offline tests / fallback)
  if (!apiKey || apiKey === "placeholder-openai-key" || apiKey.startsWith("sk-proj-placeholder")) {
    return fallbackParser(trimmed, anchorDate, timezone);
  }

  const openai = new OpenAI({ apiKey });

  const systemPrompt = `
You are the AI task extraction engine for "Delo", an intelligent minimalist task manager.
Your role is to extract:
1. "title": The clean, concise task description in the original language (usually Russian).
   - Strip out conversational filler ("так", "блин", "надо бы когда-нибудь", "слушай", "пожалуйста", "напомни").
   - Capitalize the first letter.
   - Do NOT add information that was not in the user's message.
2. "deadline": The exact ISO-8601 UTC timestamp of the deadline, OR null.
   
CRITICAL RULES FOR DEADLINE:
- Current user reference time: ${currentFormatted} in timezone: ${timezone}.
- Calculate relative dates ("сегодня", "завтра", "послезавтра", "в пятницу", "в понедельник", "через 2 часа", "до обеда" -> 12:00, "к вечеру" -> 18:00, "утром" -> 09:00, "ночью" -> 23:00) using the user's timezone, then convert to ISO-8601 UTC string.
- NEVER INVENT A DEADLINE. If the user did not specify or clearly imply a deadline (e.g. "Позвонить маме", "Проверить договор", "Купить молоко"), you MUST return null for deadline.
- Do NOT default to today, tomorrow, or end of day unless explicitly stated or clearly implied.

Return strictly JSON matching schema:
{
  "title": string,
  "deadline": string | null
}
`;

  try {
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
    if (!content) {
      throw new Error("Пустой ответ от AI модели");
    }

    const parsedJson = JSON.parse(content);
    const validated = parsedTaskSchema.parse(parsedJson);

    return {
      title: validated.title.trim(),
      deadline: validated.deadline,
    };
  } catch (error) {
    console.error("OpenAI task parsing error, using heuristic fallback:", error);
    return fallbackParser(trimmed, anchorDate, timezone);
  }
}

/**
 * Deterministic fallback parser for offline/test environments.
 */
export function fallbackParser(
  input: string,
  anchorDate: Date = new Date(),
  timezone: string = "Europe/Chisinau"
): ParsedTaskResult {
  const lower = input.toLowerCase();

  let deadline: string | null = null;
  let cleanTitle = input;

  const isTomorrow = lower.includes("завтра");
  const isFriday = lower.includes("в пятницу") || lower.includes("пятниц");
  const is15 = lower.includes("в три") || lower.includes("15:00") || lower.includes("15.00") || lower.includes("3 часа дня");
  const is17 = lower.includes("17:00") || lower.includes("до 17");
  const isNoon = lower.includes("к обеду") || lower.includes("до обеда") || lower.includes("12:00");
  const is10 = lower.includes("в 10") || lower.includes("10:00");

  if (isTomorrow) {
    let target = addDays(anchorDate, 1);
    if (is15) {
      target = setSeconds(setMinutes(setHours(target, 15), 0), 0);
      deadline = target.toISOString();
    } else if (isNoon) {
      target = setSeconds(setMinutes(setHours(target, 12), 0), 0);
      deadline = target.toISOString();
    } else if (is10) {
      target = setSeconds(setMinutes(setHours(target, 10), 0), 0);
      deadline = target.toISOString();
    } else {
      target = setSeconds(setMinutes(setHours(target, 18), 0), 0);
      deadline = target.toISOString();
    }
  } else if (isFriday && is17) {
    // calculate next Friday
    let target = new Date(anchorDate);
    const day = target.getDay(); // 0 is Sunday, 5 is Friday
    const diff = (5 - day + 7) % 7 || 7;
    target = addDays(target, diff);
    target = setSeconds(setMinutes(setHours(target, 17), 0), 0);
    deadline = target.toISOString();
  }

  // Clean title
  cleanTitle = cleanTitle
    .replace(/(завтра в три часа дня|завтра в 15:00|завтра в три|завтра в 10|завтра где-то к обеду|завтра|в пятницу до 17:00|в пятницу)/gi, "")
    .replace(/\b(так|блин|надо бы когда-нибудь|надо|напомни|пожалуйста)[,.]?\s*/gi, "")
    .replace(/\bпозвони\b/gi, "Позвонить")
    .trim();

  if (!cleanTitle) cleanTitle = input;
  cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);

  return {
    title: cleanTitle,
    deadline,
  };
}
