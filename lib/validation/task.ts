import { z } from "zod";

export const createTaskSchema = z.object({
  title: z
    .string()
    .min(1, "Название задачи не может быть пустым")
    .max(500, "Название задачи слишком длинное"),
  deadline: z.string().nullable().optional(),
  source: z.enum(["web", "telegram"]).default("web"),
  inputType: z.enum(["manual", "text", "voice"]).default("manual"),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1, "Название задачи не может быть пустым").max(500).optional(),
  deadline: z.string().nullable().optional(),
  completed: z.boolean().optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
