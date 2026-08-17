import { describe, it, expect } from "vitest";
import { findBestMatchingTask, calculateMatchScore, extractStems } from "@/lib/utils/matching";
import { Task } from "@/types";

describe("Fuzzy Task Matcher & Stemming", () => {
  const sampleTasks: Task[] = [
    {
      id: "task-1",
      user_id: "u1",
      title: "Написать отчет по продажам",
      deadline: "2026-08-20T15:00:00.000Z",
      completed: false,
      source: "telegram",
      input_type: "text",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "task-2",
      user_id: "u1",
      title: "Купить 2 литра молока в магазине",
      deadline: null,
      completed: false,
      source: "telegram",
      input_type: "voice",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "task-3",
      user_id: "u1",
      title: "Созвониться с юристом по договору",
      deadline: "2026-08-22T10:00:00.000Z",
      completed: true,
      source: "web",
      input_type: "manual",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  it("should match tasks by mention with case declension (отчета -> Написать отчет)", () => {
    const match = findBestMatchingTask(sampleTasks, "отчета", "set_deadline");
    expect(match).toBeDefined();
    expect(match?.id).toBe("task-1");
  });

  it("should match tasks by partial keyword (молоко -> Купить 2 литра молока)", () => {
    const match = findBestMatchingTask(sampleTasks, "молоко", "complete_task");
    expect(match).toBeDefined();
    expect(match?.id).toBe("task-2");
  });

  it("should prefer active/uncompleted tasks for complete and delete intents", () => {
    const duplicateTasks: Task[] = [
      {
        id: "active-doc",
        user_id: "u1",
        title: "Подготовить документы",
        deadline: null,
        completed: false,
        source: "web",
        input_type: "manual",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "done-doc",
        user_id: "u1",
        title: "Подготовить документы",
        deadline: null,
        completed: true,
        source: "web",
        input_type: "manual",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const matchComplete = findBestMatchingTask(duplicateTasks, "документы", "complete_task");
    expect(matchComplete?.id).toBe("active-doc");

    const matchUncomplete = findBestMatchingTask(duplicateTasks, "документы", "uncomplete_task");
    expect(matchUncomplete?.id).toBe("done-doc");
  });

  it("should return null when no plausible task matches", () => {
    const match = findBestMatchingTask(sampleTasks, "полететь на марс", "delete_task");
    expect(match).toBeNull();
  });
});
