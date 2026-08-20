# Delo — Task Manager for Web + Telegram

Delo is a task management application that operates seamlessly across both a modern web dashboard and Telegram. Users can create, update, and manage tasks using natural language text or voice notes via Telegram, with immediate synchronization to the web interface.

---

## 🌐 Live Application & Links

* 🖥️ **Web Application:** [https://delo-dusky.vercel.app](https://delo-dusky.vercel.app)
* 🤖 **Telegram Bot:** [@delo_task_bot](https://t.me/delo_task_bot)
* 📦 **Source Code:** [https://github.com/NikitaDmitrenco/delo](https://github.com/NikitaDmitrenco/delo)

---

## 🎯 What it demonstrates

Delo demonstrates practical skills in multi-system integration, bot development, and AI-assisted workflows:

- **Full-Stack Web Application**: Task dashboard built with Next.js App Router and React 19.
- **Telegram Bot Development**: Interactive bot built with grammY supporting both Webhook and local polling modes.
- **Multi-System Integration**: Real-time communication between Telegram, backend services, AI models, and PostgreSQL.
- **AI Task Parsing**: Natural language parsing using OpenAI GPT-4o-mini with structured JSON schemas and timezone-aware deadline extraction.
- **Voice Transcription**: Ingesting Telegram `.oga` audio messages and transcribing via OpenAI Whisper.
- **Authentication & Multi-Tenant Data Isolation**: Supabase Auth with PostgreSQL Row Level Security (RLS) ensuring strict user data privacy.
- **Telegram ↔ Web Account Linking**: Secure phone contact verification and single-use token binding.
- **Offline Deterministic Fallback**: Built-in regex and date arithmetic engine allowing core parsing when AI APIs are unavailable.

---

## 🏗️ Architecture & How It Works

### System Flowchart

```text
┌─────────────────────────────────────────────────────────────┐
│                      TELEGRAM CLIENT                        │
│             Text Message  │  Voice Note (.oga)              │
└───────────────────────────┼─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    TELEGRAM BOT (grammY)                    │
│          Webhook (/api/telegram/webhook) or Polling         │
└───────────────────────────┬─────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼ (if voice note)           ▼ (if text message)
┌───────────────────────────┐ ┌───────────────────────────────┐
│     Whisper Audio STT     │ │                               │
│  Transcribes .oga to text │ │                               │
└─────────────┬─────────────┘ │                               │
              └─────────────┬─┘                               │
                            ▼                                 │
┌─────────────────────────────────────────────────────────────┐
│                  AI TASK & INTENT PARSER                    │
│   OpenAI GPT-4o-mini (Structured Outputs) / Fallback Engine │
│   Extracts: Intent · Title · Deadline (Timezone) · Duration │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   ZOD SCHEMA VALIDATION                     │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 SUPABASE POSTGRESQL DATABASE                │
│    Tasks Table · Profiles Table · Row Level Security (RLS)  │
└───────────────────────────▲─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   NEXT.JS WEB DASHBOARD                     │
│      React 19 · Real-time task view · Supabase Auth         │
└─────────────────────────────────────────────────────────────┘
```

### Component Breakdown:
1. **Telegram Bot Layer**: Listens for incoming events via grammY. Checks whether the sender is linked to a Delo account.
2. **Audio Processing**: For voice notes, downloads the `.oga` file and forwards the audio buffer to OpenAI Whisper for speech-to-text transcription.
3. **AI Extraction Layer**: Sends the text to OpenAI GPT-4o-mini with wall-clock time and user timezone context, extracting typed JSON fields (`intent`, `title`, `deadline`, `estimatedDurationMinutes`).
4. **Validation Layer**: Validates extracted fields with Zod schemas to ensure type correctness.
5. **Database Layer**: Persists tasks to Supabase PostgreSQL. Authenticated web clients access records through Row Level Security (RLS).
6. **Web Dashboard**: Next.js App Router frontend displaying synchronized tasks, completion checkboxes, and deadlines.

---

## 🔄 Example Flows

### 1. Telegram Text Message Flow
```text
User sends text: "Завтра в 17:00 отправить документы"
  ↓
Telegram Bot receives message and verifies linked user profile
  ↓
AI parser extracts structured JSON:
  {
    "intent": "create_task",
    "title": "Отправить документы",
    "deadline": "2026-08-21T14:00:00.000Z",
    "estimatedDurationMinutes": 30
  }
  ↓
Zod validates structured payload
  ↓
Task is inserted into PostgreSQL with user_id = profile.id
  ↓
Bot replies: "✅ Задача добавлена: Отправить документы (Дедлайн: Завтра в 17:00)"
  ↓
Task appears immediately on the web dashboard
```

### 2. Telegram Voice Message Flow
```text
User sends voice note: "Напомни в пятницу до 18:00 подготовить отчет"
  ↓
Bot downloads .oga audio file from Telegram API
  ↓
OpenAI Whisper transcribes audio to Russian text
  ↓
AI parser extracts intent, title, and calculates Friday 18:00 in user timezone
  ↓
Task is saved to PostgreSQL database
  ↓
Bot replies with confirmation and transcript preview
  ↓
Task is visible on web dashboard
```

---

## 🔐 Authentication & Data Isolation

- **Supabase Auth**: Handles web authentication (registration, login, cookie sessions).
- **PostgreSQL Row Level Security (RLS)**: Enforces table policies directly inside PostgreSQL. Web users can only `SELECT`, `INSERT`, `UPDATE`, and `DELETE` tasks where `auth.uid() = user_id`.
- **Bot Operations**: The Telegram bot operates via a server-side client with admin privileges (`SUPABASE_SERVICE_ROLE_KEY`) to match incoming Telegram IDs against user profiles and insert tasks on behalf of the verified owner.

---

## 🔗 Telegram ↔ Web Account Linking

Delo supports two linking methods:

1. **One-Tap Phone Contact Verification**:
   - In Telegram, the user clicks **«📱 Поделиться номером для привязки»**.
   - The bot receives the contact object and normalizes the phone digits.
   - It matches the number with registered profiles in Supabase and binds `telegram_user_id`.
2. **Single-Use Cryptographic Token**:
   - When an unlinked user sends `/start`, the bot creates a single-use token (`delo_<random_hex>`) with a 15-minute expiration stored in `telegram_link_tokens`.
   - The user opens the registration link (`https://delo-dusky.vercel.app/register?token=...`).
   - Upon creating an account, the backend links the profile to the Telegram user ID.

---

## 🛠️ Tech Stack

- **Web Frontend**: Next.js 16/15 (App Router), React 19, TypeScript, Tailwind CSS v4, Lucide Icons
- **Backend & Database**: Supabase (PostgreSQL, Supabase Auth, Row Level Security)
- **Telegram Bot**: grammY (TypeScript framework)
- **AI & Audio**: OpenAI GPT-4o-mini (Structured Outputs), OpenAI Whisper (Audio STT), Deterministic Fallback Engine
- **Validation & Dates**: Zod, `date-fns`, `date-fns-tz`
- **Testing**: Vitest (50 automated unit & integration tests)

---

## 🧪 Testing

The repository includes **50 automated unit and integration tests** verified with Vitest across 11 test suites:

- **AI Parser**: Validates intent classification (`create_task`, `complete_task`, `delete_task`, `set_deadline`), title cleanup, and duration estimates.
- **Date & Timezone Engine**: Tests relative dates (*«послезавтра»*, *«во вторник»*, *«через 2 часа»*) anchored to specific timezones.
- **Fuzzy Matcher**: Validates resolving target tasks from conversational queries (*«поставь галочку на задаче купить молоко»*).
- **Auth Validation**: Schema validation for registration, login, and token formats.
- **Telegram Bot Handlers**: Tests command parsing, callback actions, and contact linking logic.
- **End-to-End Simulation**: Simulates dual-user isolation, Telegram ingestion, and status toggles.

```bash
# Run all 50 Vitest tests
npm run test
```

---

## 📁 Project Structure

```text
delo/
├── app/
│   ├── (auth)/                   # Login & registration pages
│   ├── (dashboard)/              # Synchronized task dashboard
│   ├── api/
│   │   ├── auth/                 # Auth route handlers
│   │   ├── tasks/                # REST endpoints for task CRUD
│   │   └── telegram/webhook/     # Telegram webhook handler
│   └── layout.tsx
├── components/
│   ├── landing/                  # Landing page sections & demos
│   └── tasks/                    # Task dashboard, form, edit modal, items
├── lib/
│   ├── supabase/                 # Client, server, admin, and middleware helpers
│   ├── utils/                    # Date formatting, class merge, fuzzy matching
│   └── validation/               # Zod schemas for auth and tasks
├── services/
│   ├── ai/                       # OpenAI GPT-4o-mini structured parser & offline engine
│   ├── audio/                    # OpenAI Whisper STT integration
│   ├── reminders/                # Reminder calculation logic
│   └── telegram/                 # grammY bot setup and command handlers
├── supabase/
│   └── migrations/               # PostgreSQL schema & Row Level Security policies
├── telegram/
│   └── dev-polling.ts            # Local development long-polling runner
├── tests/
│   ├── integration/              # End-to-end multi-user integration tests
│   └── unit/                     # 10 unit test suites (parser, dates, matching, bot)
└── package.json
```

---

## 💻 Local Development

### 1. Clone & Install
```bash
git clone https://github.com/NikitaDmitrenco/delo.git
cd delo
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Fill in your development keys:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

OPENAI_API_KEY=your_openai_api_key

TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_BOT_USERNAME=delo_task_bot

NEXT_PUBLIC_APP_URL=http://localhost:3000
DEFAULT_USER_TIMEZONE=Europe/Chisinau
```

### 3. Run Local Web App
```bash
npm run dev
```

### 4. Run Telegram Bot Locally (Long Polling)
```bash
npm run bot:dev
```

### 5. Run Automated Tests
```bash
npm run test
```

---

## 🔍 Limitations & Next Steps

This application is built as an MVP and portfolio project. For a high-traffic production SaaS deployment, the following areas would be the next focus:

- **Production Rate Limiting**: Applying rate limiting to the Telegram webhook endpoint and OpenAI API routes to guard against abuse.
- **Webhook Security**: Verifying Telegram webhook secret tokens on every incoming request.
- **Monitoring & Observability**: Integrating error reporting (e.g. Sentry) and metric tracking for webhook latency and transcription failure rates.
- **Asynchronous Task Queue**: Moving heavy AI parsing and scheduled reminder notifications to background job workers.
- **Automated Backups**: Setting up automated PostgreSQL point-in-time recovery (PITR).

