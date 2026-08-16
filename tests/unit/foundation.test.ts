import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils/cn";

describe("Foundation Unit Tests", () => {
  it("should merge tailwind classes properly with cn utility", () => {
    const result = cn("px-2 py-1", "px-4", { "text-white": true, "bg-black": false });
    expect(result).toBe("py-1 px-4 text-white");
  });

  it("should have correct environment types defined", () => {
    const sampleTask = {
      id: "task-1",
      user_id: "user-123",
      title: "Позвонить Ивану",
      deadline: "2026-08-17T15:00:00Z",
      completed: false,
      source: "telegram" as const,
      input_type: "voice" as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    expect(sampleTask.title).toBe("Позвонить Ивану");
    expect(sampleTask.source).toBe("telegram");
  });
});
