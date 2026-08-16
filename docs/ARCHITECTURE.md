# DELO — Architecture & System Design

This document describes the technical architecture, data flows, security model, and component interactions of Delo.

---

## 1. High-Level Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                                     CLIENTS                                       |
|                                                                                   |
|    +-------------------------+                     +-------------------------+    |
|    |      Telegram App       |                     |     Web Browser         |    |
|    | (Voice & Text Messages) |                     |   (Next.js React UI)    |    |
|    +------------+------------+                     +------------+------------+    |
+-----------------|-----------------------------------------------|-----------------+
                  |                                               |
                  v                                               v
+-----------------+-----------------------------------------------+-----------------+
|                                APPLICATION LAYER                                  |
|                                                                                   |
|   +--------------------------+                     +--------------------------+   |
|   |   Telegram Bot Service   |                     |     Next.js App Router   |   |
|   |  (grammY Webhook/Poll)   |                     |  - Landing Page          |   |
|   +-------------+------------+                     |  - Auth (Login/Register) |   |
|                 |                                  |  - Task Dashboard (CRUD) |   |
|                 v                                  |  - SSR Auth Middleware   |   |
|   +--------------------------+                     +------------+-------------+   |
|   | Speech-to-Text (Whisper) |                                  |                 |
|   +-------------+------------+                                  |                 |
|                 |                                               |                 |
|                 v                                               |                 |
|   +--------------------------+                                  |                 |
|   |   AI Task Parser (LLM)   |                                  |                 |
|   |  (GPT-4o-mini + Zod)     |                                  |                 |
|   +-------------+------------+                                  |                 |
|                 |                                               |                 |
+-----------------|-----------------------------------------------|-----------------+
                  |                                               |
                  +-----------------------+-----------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                                DATA & AUTH LAYER                                  |
|                                                                                   |
|                               +-------------------+                               |
|                               |     SUPABASE      |                               |
|                               |  - Supabase Auth  |                               |
|                               |  - Postgres RLS   |                               |
|                               |  - Realtime/RPC   |                               |
|                               +-------------------+                               |
+-----------------------------------------------------------------------------------+
```

---

## 2. Database Schema Design (PostgreSQL / Supabase)

### `profiles` table
Stores application user profiles linked to Supabase Auth `auth.users.id`.

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  phone text unique,
  telegram_user_id bigint unique,
  telegram_username text,
  timezone text not null default 'Europe/Chisinau',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

### `tasks` table
Stores tasks owned by users.

```sql
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  deadline timestamp with time zone,
  completed boolean not null default false,
  source text not null check (source in ('telegram', 'web')),
  input_type text not null check (input_type in ('text', 'voice', 'manual')),
  original_input text,
  transcript text,
  ai_metadata jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

### `telegram_link_tokens` table
Stores cryptographically random single-use tokens for deep linking Telegram users with web accounts.

```sql
create table public.telegram_link_tokens (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  telegram_user_id bigint not null,
  telegram_username text,
  expires_at timestamp with time zone not null,
  used boolean not null default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

---

## 3. Row Level Security (RLS) Policies

All tables have RLS enabled by default:
- `ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;`
- `ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;`

### Isolation Rules:
1. **Tasks Policy**:
   - `SELECT`, `INSERT`, `UPDATE`, `DELETE` allowed **ONLY** where `auth.uid() = user_id`.
2. **Profiles Policy**:
   - `SELECT`, `UPDATE` allowed **ONLY** where `auth.uid() = id`.
3. **Backend Service Role**:
   - Telegram Bot service accesses the database using `SUPABASE_SERVICE_ROLE_KEY` to look up `telegram_user_id` and insert tasks on behalf of the verified linked user.

---

## 4. AI Task Extraction Engine

- **Service**: `parseTaskInput(input: string, anchorDate: Date, timezone: string): Promise<ParsedTaskResult>`
- **Model**: `gpt-4o-mini` with strict structured output.
- **Rules**:
  1. Extract only the clear action item as `title`.
  2. If a relative date/time is provided ("tomorrow", "in 2 hours", "on Friday at 5pm"), calculate the ISO-8601 UTC timestamp based on the provided `anchorDate` and user `timezone`.
  3. If no deadline is stated, return `deadline: null`. Never make up a deadline.
  4. Response is validated with `zod` before saving to database.

---

## 5. Voice Transcription Pipeline

1. Telegram receives voice note message.
2. Bot retrieves file info using `bot.api.getFile(file_id)`.
3. Audio buffer is downloaded over HTTPS.
4. Audio buffer is streamed to OpenAI Whisper API (`v1/audio/transcriptions`) specifying Russian/auto language.
5. Transcribed text enters the AI Task Extraction Engine.
