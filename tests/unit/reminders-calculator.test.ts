import { describe, it, expect } from "vitest";
import { calculateRemindAt, estimateDefaultDuration } from "@/services/reminders/calculator";

describe("Predictive Reminders Calculator", () => {
  const now = new Date("2026-08-17T12:00:00.000Z");

  it("should calculate remind_at = deadline - (duration + buffer)", () => {
    // Deadline is 18:00 (360 mins from now)
    const deadlineIso = new Date("2026-08-17T18:00:00.000Z").toISOString();
    const durationMinutes = 120; // 2 hours
    const bufferMinutes = 20;    // 20 mins

    // Total subtraction = 140 mins -> 15:40
    const remindAtIso = calculateRemindAt(deadlineIso, durationMinutes, bufferMinutes, now);
    expect(remindAtIso).toBeDefined();

    const remindDate = new Date(remindAtIso!);
    expect(remindDate.getUTCHours()).toBe(15);
    expect(remindDate.getUTCMinutes()).toBe(40);
  });

  it("should return null if no deadline is specified", () => {
    const remindAtIso = calculateRemindAt(null, 60, 20, now);
    expect(remindAtIso).toBeNull();
  });

  it("should return null if deadline is already in the past", () => {
    const pastDeadline = new Date("2026-08-17T10:00:00.000Z").toISOString();
    const remindAtIso = calculateRemindAt(pastDeadline, 30, 20, now);
    expect(remindAtIso).toBeNull();
  });

  it("should schedule immediately (+1 min) if calculated remind_at is in the past but deadline is future", () => {
    // Deadline in 30 mins from now (12:30), but total offset is 60+20=80 mins
    const tightDeadline = new Date("2026-08-17T12:30:00.000Z").toISOString();
    const remindAtIso = calculateRemindAt(tightDeadline, 60, 20, now);

    expect(remindAtIso).toBeDefined();
    const remindDate = new Date(remindAtIso!);
    expect(remindDate.getTime()).toBeGreaterThan(now.getTime());
    expect(remindDate.getUTCMinutes()).toBe(1); // 12:01
  });

  it("should estimate appropriate default durations for various task scopes", () => {
    expect(estimateDefaultDuration("Позвонить врачу")).toBe(15);
    expect(estimateDefaultDuration("Подготовить налоговый отчет")).toBe(120);
    expect(estimateDefaultDuration("Сходить на тренировку")).toBe(60);
  });
});
