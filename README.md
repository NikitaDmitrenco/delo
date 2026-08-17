# DELO — Turn Thoughts into Done

> **Delo** is an AI-powered minimalist task manager that enables users to create and organize tasks seamlessly via Telegram (text & voice) and a modern web interface.

---

## 🌐 Live Demo & Deployment

The application and Telegram bot are deployed and running in production 24/7:

| Service | Link |
| :--- | :--- |
| 🖥️ **Web Application** | [https://delo-dusky.vercel.app](https://delo-dusky.vercel.app) |
| 🤖 **Telegram Bot** | [@delo_task_bot](https://t.me/delo_task_bot) |
| 📊 **Database** | Supabase (PostgreSQL with RLS) |

### ⚡ How to Test the Project Live (in 1 minute):

1. **Open the Bot**: Start [@delo_task_bot](https://t.me/delo_task_bot) in Telegram and send `/start`.
2. **Link Account**: Tap **«📱 Поделиться номером для привязки»** (or create an account via the provided link).
3. **Add a Task via Text**: Send any natural message, for example:
   * *«Сегодня до 20:00 дописать статью»*
   * *«В пятницу до 17:00 отправить документы»*
4. **Add a Task via Voice**: Send a voice message describing your task (transcribed by OpenAI Whisper + structured by GPT-4o-mini).
5. **View on Web Dashboard**: Open [https://delo-dusky.vercel.app/dashboard](https://delo-dusky.vercel.app/dashboard) to view your real-time synced tasks, toggle completions, and manage deadlines.

---

## ⚡ Key Highlights

- 🎙️ **Voice & Text Ingestion**: Send a voice note or type a message in Telegram. Delo automatically transcribes and parses it.
- 🧠 **Context & Timezone Aware AI**: Extracts task title and deadline relative to your local timezone (e.g. `Europe/Chisinau`).
- 🎯 **No Invented Deadlines**: If no deadline is stated or implied, none is added (`deadline: null`).
- 🔐 **Isolated & Secure**: Supabase Auth with PostgreSQL Row Level Security (RLS) ensures strict tenant data isolation.
- 📱 **Telegram ↔ Web Linking**: Secure single-use cryptographic token flow & phone contact matching binds Telegram accounts to web accounts.
- ✨ **Minimalist Design**: Clean typography, high whitespace, fast interactions, zero clutter.

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 15+ (App Router), React 19, TypeScript, Tailwind CSS v4, Lucide Icons
- **Backend & Storage**: Supabase (PostgreSQL, Supabase Auth, Row Level Security)
- **Telegram Bot**: grammY (TypeScript Bot Framework with dual Webhook & Local Polling modes)
- **AI & NLP**: OpenAI GPT-4o-mini (Structured Outputs / JSON schema) + OpenAI Whisper (Audio STT) + Unicode Cyrillic Fallback NLP
- **Validation & Dates**: Zod, Date-fns, Date-fns-tz
- **Testing**: Vitest (32 passing unit & integration tests)

---

## 📂 Project Documentation

Detailed documentation is available in the [`/docs`](./docs) directory:

- [📄 `docs/PROJECT.md`](./docs/PROJECT.md) — Product overview, user flows, and core principles.
- [🏛️ `docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — System architecture, data schema, AI pipeline, security model.
- [🗺️ `docs/ROADMAP.md`](./docs/ROADMAP.md) — Milestones progress and upcoming features.
- [📝 `docs/DECISIONS.md`](./docs/DECISIONS.md) — Architectural Decision Records (ADRs).
- [🚀 `docs/SETUP.md`](./docs/SETUP.md) — Local development and environment setup guide.

---

## 🚀 Local Quick Start

1. **Clone the repository**:
   ```bash
   git clone https://github.com/NikitaDmitrenco/delo.git
   cd delo
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env.local
   # Fill in your Supabase, OpenAI, and Telegram credentials
   ```

4. **Run local web application**:
   ```bash
   npm run dev
   ```

5. **Run Telegram bot locally (long-polling)**:
   ```bash
   npm run bot:dev
   ```

6. **Run tests**:
   ```bash
   npm run test
   ```

---

## 📄 License

MIT © [Nikita Dmitrenco](https://github.com/NikitaDmitrenco)
