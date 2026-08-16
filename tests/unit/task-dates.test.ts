import { describe, it, expect } from "vitest";
import { formatDeadline, isOverdue } from "@/lib/utils/dates";
import { createTaskSchema, updateTaskSchema } from "@/lib/validation/task";
import { addDays, subDays } from "date-fns";

describe("Task Dates & Validation", () => {
  describe("formatDeadline", () => {
    it("should return 'Без дедлайна' for null or empty dates", () => {
      expect(formatDeadline(null)).toBe("Без дедлайна");
      expect(formatDeadline(undefined)).toBe("Без дедлайна");
      expect(formatDeadline("invalid-date-string")).toBe("Без дедлайна");
    });

    it("should format today dates with 'Сегодня'", () => {
      const today = new Date();
      today.setHours(15, 30, 0, 0);
      const result = formatDeadline(today.toISOString());
      expect(result).toBe("Сегодня · 15:30");
    });

    it("should format tomorrow dates with 'Завтра'", () => {
      const tomorrow = addDays(new Date(), 1);
      tomorrow.setHours(10, 0, 0, 0);
      const result = formatDeadline(tomorrow.toISOString());
      expect(result).toBe("Завтра · 10:00");
    });
  });

  describe("isOverdue", () => {
    it("should return false for null deadlines or completed tasks", () => {
      expect(isOverdue(null, false)).toBe(false);
      expect(isOverdue(new Date().toISOString(), true)).toBe(false);
    });

    it("should return true for past uncompleted dates", () => {
      const pastDate = subDays(new Date(), 2);
      expect(isOverdue(pastDate.toISOString(), false)).toBe(true);
    });

    it("should return false for future dates", () => {
      const futureDate = addDays(new Date(), 2);
      expect(isOverdue(futureDate.toISOString(), false)).toBe(false);
    });
  });

  describe("Task Validation Schemas", () => {
    it("should validate valid create task payload", () => {
      const payload = {
        title: "Позвонить Сергею",
        deadline: new Date().toISOString(),
        source: "telegram" as const,
        inputType: "voice" as const,
      };
      const result = createTaskSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it("should reject empty task title", () => {
      const payload = { title: "" };
      expect(createTaskSchema.safeParse(payload).success).toBe(false);
    });

    it("should validate task updates", () => {
      const payload = {
        completed: true,
        title: "Обновленный заголовок",
      };
      expect(updateTaskSchema.safeParse(payload).success).toBe(true);
    });
  });
});
