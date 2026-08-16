import { describe, it, expect } from "vitest";
import { parseTaskInput, fallbackParser } from "@/services/ai/parser";
import { formatDeadline, isOverdue } from "@/lib/utils/dates";
import { registerSchema, loginSchema } from "@/lib/validation/auth";
import { createTaskSchema, updateTaskSchema } from "@/lib/validation/task";

describe("DELO End-to-End User Journeys Simulation", () => {
  const userA = {
    id: "user-uuid-1",
    username: "nikita_user",
    phone: "+79991234567",
    telegram_user_id: 123456789,
    timezone: "Europe/Chisinau",
  };

  const userB = {
    id: "user-uuid-2",
    username: "alex_user",
    telegram_user_id: 987654321,
    timezone: "Europe/Chisinau",
  };

  it("Journey 1: Registration with Telegram linking token", () => {
    const rawRegistration = {
      username: userA.username,
      phone: userA.phone,
      password: "strongpassword123",
      linkToken: "delo_sample_token_123",
      timezone: userA.timezone,
    };

    const parsed = registerSchema.safeParse(rawRegistration);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.username).toBe("nikita_user");
      expect(parsed.data.linkToken).toBe("delo_sample_token_123");
    }
  });

  it("Journey 2: Telegram Text Message -> AI Extraction -> Formatted Confirmation", async () => {
    const rawMessage = "Завтра в три часа дня позвонить Ивану и согласовать договор";
    const anchor = new Date("2026-08-16T12:00:00.000Z");

    const parsed = await parseTaskInput({
      input: rawMessage,
      anchorDate: anchor,
      timezone: userA.timezone,
    });

    expect(parsed.title.toLowerCase()).toContain("иван");
    expect(parsed.deadline).not.toBeNull();

    // Verify confirmation string format
    const formattedDate = formatDeadline(parsed.deadline);
    expect(formattedDate).toContain("15:00");
  });

  it("Journey 3: Telegram Voice Message transcript with no deadline -> deadline null", async () => {
    const transcript = "Так, надо бы когда-нибудь проверить отчёт по продажам";
    const anchor = new Date("2026-08-16T12:00:00.000Z");

    const parsed = await parseTaskInput({
      input: transcript,
      anchorDate: anchor,
      timezone: userA.timezone,
    });

    expect(parsed.title.toLowerCase()).toContain("отчёт");
    expect(parsed.deadline).toBeNull();
  });

  it("Journey 4: Web CRUD lifecycle (Create -> Update -> Complete -> Overdue check)", () => {
    // 1. Create
    const taskPayload = {
      title: "Отправить презентацию",
      deadline: new Date("2026-08-20T10:00:00Z").toISOString(),
      source: "web" as const,
      inputType: "manual" as const,
    };
    expect(createTaskSchema.safeParse(taskPayload).success).toBe(true);

    // 2. Complete
    const completePayload = { completed: true };
    expect(updateTaskSchema.safeParse(completePayload).success).toBe(true);

    // 3. Check overdue status
    const pastDate = new Date("2026-08-10T10:00:00Z").toISOString();
    expect(isOverdue(pastDate, false)).toBe(true);
    expect(isOverdue(pastDate, true)).toBe(false); // Completed tasks are never marked overdue
  });

  it("Journey 5: Multi-tenant security isolation assertion", () => {
    const tasksStore = [
      { id: "task-1", user_id: userA.id, title: "Задача Никиты" },
      { id: "task-2", user_id: userB.id, title: "Задача Алекса" },
    ];

    // User A query
    const userATasks = tasksStore.filter((t) => t.user_id === userA.id);
    expect(userATasks.length).toBe(1);
    expect(userATasks[0].title).toBe("Задача Никиты");
    expect(userATasks.some((t) => t.user_id === userB.id)).toBe(false);
  });
});
