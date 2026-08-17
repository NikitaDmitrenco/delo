export type TaskSource = "telegram" | "web";
export type TaskInputType = "text" | "voice" | "manual";

export type TaskIntent =
  | "create_task"
  | "complete_task"
  | "uncomplete_task"
  | "delete_task"
  | "edit_title"
  | "set_deadline"
  | "remove_deadline"
  | "set_reminder_buffer";

export interface Profile {
  id: string;
  username: string | null;
  phone: string | null;
  telegram_user_id: number | null;
  telegram_username: string | null;
  timezone: string;
  reminder_buffer_minutes?: number;
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
  estimated_duration_minutes?: number | null;
  remind_at?: string | null; // ISO 8601 timestamp in UTC
  reminder_sent?: boolean;
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
  estimatedDurationMinutes?: number | null; // Estimated duration in minutes (e.g. 15, 60, 120)
  reminderBufferMinutes?: number | null;    // Requested reminder buffer for set_reminder_buffer intent
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
