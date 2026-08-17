export type TaskSource = "telegram" | "web";
export type TaskInputType = "text" | "voice" | "manual";

export type TaskIntent =
  | "create_task"
  | "complete_task"
  | "uncomplete_task"
  | "delete_task"
  | "edit_title"
  | "set_deadline"
  | "remove_deadline";

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
  intent: TaskIntent;
  targetQuery?: string | null; // Key phrase to search existing task in database
  title: string | null;        // Clean title (for creation or new title)
  deadline: string | null;     // ISO 8601 string or null
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
