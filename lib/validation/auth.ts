import { z } from "zod";

export const registerSchema = z.object({
  username: z
    .string()
    .min(3, "Имя пользователя должно содержать минимум 3 символа")
    .max(32, "Имя пользователя не должно превышать 32 символа")
    .regex(/^[a-zA-Z0-9_]+$/, "Имя пользователя может содержать только латинские буквы, цифры и _"),
  phone: z
    .string()
    .optional()
    .refine((val) => !val || /^\+?[0-9]{7,15}$/.test(val.replace(/[\s-()]/g, "")), {
      message: "Некорректный формат номера телефона",
    }),
  password: z
    .string()
    .min(6, "Пароль должен содержать минимум 6 символов"),
  linkToken: z.string().optional(),
  timezone: z.string().default("Europe/Chisinau"),
});

export const loginSchema = z.object({
  identifier: z
    .string()
    .min(1, "Введите имя пользователя или номер телефона"),
  password: z
    .string()
    .min(1, "Введите пароль"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
