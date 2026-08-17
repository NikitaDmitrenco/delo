import { describe, it, expect } from "vitest";
import { fallbackParser } from "@/services/ai/parser";

describe("Buffer Settings Intent & Fallback Duration Estimation", () => {
  const anchorDate = new Date("2026-08-17T12:00:00.000Z");

  it("should classify set_reminder_buffer intent and extract 30 minutes", () => {
    const res = fallbackParser("поставь таймер напоминания по умолчанию за 30 минут", anchorDate);
    expect(res.intent).toBe("set_reminder_buffer");
    expect(res.reminderBufferMinutes).toBe(30);
  });

  it("should classify set_reminder_buffer with word numbers (пятнадцать минут)", () => {
    const res = fallbackParser("сделай буфер напоминаний за пятнадцать минут", anchorDate);
    expect(res.intent).toBe("set_reminder_buffer");
    expect(res.reminderBufferMinutes).toBe(15);
  });

  it("should assign estimated duration for create_task", () => {
    const res = fallbackParser("Написать отчет по продажам завтра к 18:00", anchorDate);
    expect(res.intent).toBe("create_task");
    expect(res.estimatedDurationMinutes).toBe(120);
  });
});
