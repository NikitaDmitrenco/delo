export type TaskSource = "telegram" | "web";
export type TaskInputType = "text" | "voice" | "manual";

export interface Profile {
  id: string;
  username: string | null;
  phone: string | null;
  telegram_user_id: number | null;
  telegram_username: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  deadline: string | null; // ISO 8601 string in UTC or null
  completed: boolean;
  source: TaskSource;
  input_type: TaskInputType;
  original_input?: string | null;
  transcript?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParsedTaskResult {
  title: string;
  deadline: string | null; // ISO 8601 string or null
}

export interface TelegramLinkToken {
  id: string;
  token: string;
  telegram_user_id: number;
  telegram_username?: string | null;
  expires_at: string;
  used: boolean;
  created_at: string;
}
