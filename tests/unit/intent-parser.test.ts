import { describe, it, expect } from "vitest";
import { fallbackParser } from "@/services/ai/parser";
import { formatDeadline } from "@/lib/utils/dates";

describe("Intent Recognition & 'Послезавтра' Date Math", () => {
  const anchorDate = new Date("2026-08-17T12:00:00.000Z"); // Monday Aug 17, 2026

  it("should classify set_deadline and calculate 'послезавтра' (+2 days -> Wednesday Aug 19)", () => {
    const res = fallbackParser("перенеси задачу отчета на послезавтра", anchorDate, "Europe/Chisinau");
    expect(res.intent).toBe("set_deadline");
    expect(res.targetQuery).toContain("отчет");
    expect(res.deadline).toBeDefined();
    const formatted = formatDeadline(res.deadline, "Europe/Chisinau");
    expect(formatted).toContain("19 августа");
  });

  it("should classify complete_task intent (поставь галочку)", () => {
    const res = fallbackParser("поставь галочку на задаче купить молоко", anchorDate);
    expect(res.intent).toBe("complete_task");
    expect(res.targetQuery).toContain("купить молоко");
  });

  it("should classify uncomplete_task intent (верни в работу)", () => {
    const res = fallbackParser("верни задачу отчет в работу", anchorDate);
    expect(res.intent).toBe("uncomplete_task");
    expect(res.targetQuery).toContain("отчет");
  });

  it("should classify delete_task intent (удали задачу)", () => {
    const res = fallbackParser("удали созвон с юристом", anchorDate);
    expect(res.intent).toBe("delete_task");
    expect(res.targetQuery).toContain("созвон с юристом");
  });

  it("should classify remove_deadline intent (убери дедлайн)", () => {
    const res = fallbackParser("убери дедлайн у задачи отчет", anchorDate);
    expect(res.intent).toBe("remove_deadline");
    expect(res.targetQuery).toContain("отчет");
    expect(res.deadline).toBeNull();
  });

  it("should classify create_task and parse complex phrase with proper nouns and Tuesday", () => {
    const res = fallbackParser("отправить Отчет Мари Ванне до 15:23 до вторника", anchorDate, "Europe/Chisinau");
    expect(res.intent).toBe("create_task");
    expect(res.title).toContain("Отправить Отчет Мари Ванне");
    expect(res.deadline).toBeDefined();
    const formatted = formatDeadline(res.deadline, "Europe/Chisinau");
    expect(formatted).toContain("15:23");
  });
});
