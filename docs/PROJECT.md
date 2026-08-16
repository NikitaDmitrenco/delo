# DELO — Project Overview

> **Turn thoughts into done.**

---

## 1. What is Delo?

**Delo** is an AI-first, minimalist task manager designed for maximum capture speed and zero organizational friction.

Instead of navigating rigid forms with multiple fields (title, date picker, time dropdown, priority, categories, tags), users simply tell Delo what needs to be done:
- via **Telegram Text**
- via **Telegram Voice Note**
- via **Web Application**

Delo’s AI engine automatically extracts the core task and calculates the exact deadline based on the user's timezone, storing it in their account in real time.

---

## 2. Core Product Principles

1. **Don't organize your task. Just tell Delo what needs to be done.**  
   Capturing a thought must take under 3 seconds.
2. **Never invent deadlines.**  
   If the user didn't mention or imply a date/time, `deadline: null` is preserved. Never default to "today" or "end of day".
3. **Timezone Awareness.**  
   All relative expressions ("tomorrow at 3pm", "on Friday", "in 2 hours") are computed against the user's local timezone.
4. **Tenant Isolation & Security.**  
   User A can never see or mutate User B's tasks under any circumstances. Row Level Security (RLS) is enforced at the database level.
5. **No Clutter (Less, but better).**  
   No bloated enterprise features (subtasks, collaboration boards, complex tags, Gantt charts) in the MVP.

---

## 3. Main User Flows

### A. Telegram Bot Task Creation (Text)
1. User sends message: *"В пятницу до 17:00 отправить документы бухгалтеру"*.
2. Telegram Bot receives webhook or polling update.
3. Bot checks if `telegram_user_id` is linked to an active Delo account.
4. If linked, message + user timezone + anchor timestamp are passed to OpenAI task parser (`parseTaskInput`).
5. AI extracts `{ title: "Отправить документы бухгалтеру", deadline: "2026-08-21T17:00:00.000Z" }`.
6. Task is saved in Supabase database.
7. Bot replies with confirmation and formatted deadline.

### B. Telegram Bot Task Creation (Voice)
1. User sends voice message in Telegram.
2. Bot downloads audio (`.oga`), converts/sends to OpenAI Whisper API for speech-to-text.
3. Transcribed text is parsed via the AI task extraction pipeline.
4. Resulting task is validated and saved to Supabase.
5. Bot sends confirmation message.

### C. Telegram ↔ Account Linking
1. Unlinked user sends `/start` in Telegram.
2. Bot detects no linked account, generates a secure single-use linking token with a 15-minute TTL.
3. Bot responds with inline button: **"Создать аккаунт"** (direct link with deep-link token query parameter).
4. User registers or logs in on the Delo web app; the token binds the account to `telegram_user_id`.
5. User clicks **"Я создал аккаунт"** in Telegram, bot verifies linking and enables task creation.

### D. Web Task Management (CRUD)
1. Authenticated user views dashboard categorized into Active & Completed tasks.
2. User can create tasks manually with optional deadline picker.
3. User can edit title or deadline inline/via modal.
4. User can toggle completion checkbox (moves task to completed with muted style).
5. User can delete tasks with confirmation/undo.

---

## 4. Current Status

- **Milestone 0 (Project Foundation)**: Completed.
- **Next Milestone**: Milestone 1 (Database & Supabase Schema).
