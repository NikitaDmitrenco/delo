import { describe, it, expect } from "vitest";
import { parseTaskInput, fallbackParser } from "@/services/ai/parser";

describe("AI Task Parser Engine", () => {
  const anchorDate = new Date("2026-08-16T12:00:00.000Z"); // Sunday
  const timezone = "Europe/Chisinau";

  it("should extract task with tomorrow 15:00 deadline", async () => {
    const input = "Завтра в три часа дня позвонить Ивану и согласовать договор";
    const result = await parseTaskInput({ input, anchorDate, timezone });

    expect(result.title!).toBeDefined();
    expect(result.title!.toLowerCase()).toContain("иван");
    expect(result.deadline).not.toBeNull();
    const d = new Date(result.deadline!);
    expect(d.getDate()).toBe(17); // Aug 17 (tomorrow)
  });

  it("should extract task with NO deadline when none is mentioned", async () => {
    const input = "Позвонить маме";
    const result = await parseTaskInput({ input, anchorDate, timezone });

    expect(result.title).toBe("Позвонить маме");
    expect(result.deadline).toBeNull();
  });

  it("should extract task with conversational filler removed", async () => {
    const input = "Так, завтра где-то к обеду надо позвонить Сергею и узнать насчёт встречи";
    const result = await parseTaskInput({ input, anchorDate, timezone });

    expect(result.title!).toBeDefined();
    expect(result.title!.toLowerCase()).toContain("серге");
    expect(result.deadline).not.toBeNull();
  });

  it("should reject empty task input", async () => {
    await expect(
      parseTaskInput({ input: "   ", anchorDate, timezone })
    ).rejects.toThrow("Входящее сообщение пустое");
  });

  it("deterministic fallback parser should handle Friday deadline", () => {
    const input = "В пятницу до 17:00 отправить документы бухгалтеру";
    const result = fallbackParser(input, anchorDate, timezone);

    expect(result.title!).toBeDefined();
    expect(result.title!.toLowerCase()).toContain("бухгалтер");
    expect(result.deadline).not.toBeNull();
    const d = new Date(result.deadline!);
    expect(d.getDay()).toBe(5); // Friday
  });
});
