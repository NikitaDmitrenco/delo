# DELO — Roadmap & Milestones Tracking

This document tracks progress across all milestones from initialization to deployment.

---

## 📊 Milestones Progress

| Milestone | Description | Status | Commit / Notes |
| :--- | :--- | :--- | :--- |
| **M0** | **Project Foundation** | ✅ Completed | Initialized Next.js 15, TS, Tailwind CSS, Base Shell, Vitest, Docs, Git Repo |
| **M1** | **Database & Supabase** | ✅ Completed | Schemas, Migrations (001_initial_schema.sql), RLS policies, client helpers |
| **M2** | **Authentication** | ✅ Completed | Supabase Auth (username/phone), protected routes, SSR session, login/register |
| **M3** | **Task CRUD** | ✅ Completed | Dashboard UI, task list, create/edit/delete/complete, filters, date formatting |
| **M4** | **Landing Page** | ⏳ Planned | Full interactive landing page and auth experience |
| **M5** | **Telegram Bot** | ⏳ Planned | Bot core, `/start`, unlinked CTA, text tasks |
| **M6** | **AI Task Parsing** | ⏳ Planned | `parseTaskInput` service, timezone date computation, tests |
| **M7** | **Voice Transcription** | ⏳ Planned | Telegram voice download + Whisper STT pipeline |
| **M8** | **Telegram Linking** | ⏳ Planned | Deep-link token generation, web account linking, bot confirmation |
| **M9** | **UX & Accessibility Polish** | ⏳ Planned | Responsive design, keyboard navigation, transitions |
| **M10** | **Comprehensive Testing** | ⏳ Planned | Unit & Integration tests for Auth, Tasks, Security, AI, Bot |
| **M11** | **Production Deployment** | ⏳ Planned | Vercel deployment, Webhook configuration, Prod Supabase setup |

---

## 🎯 Current Milestone: Milestone 0 (COMPLETED)
- Next.js 15+ App Router, TypeScript, Tailwind CSS v4 initialized.
- Core packages installed: `@supabase/ssr`, `grammy`, `openai`, `zod`, `date-fns`, `lucide-react`, `vitest`.
- Baseline landing preview and layout created.
- Full documentation suite (`PROJECT.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `DECISIONS.md`, `SETUP.md`, `.env.example`, `README.md`) established.
- Git initialized with GitHub repository `NikitaDmitrenco/delo`.

---

## ⏭️ Next Milestone: Milestone 1 — Database & Supabase
- Define PostgreSQL schema migrations in `supabase/migrations/`.
- Setup `profiles`, `tasks`, and `telegram_link_tokens` tables.
- Implement Row Level Security (RLS) policies for complete tenant isolation.
- Add database helper client libraries (`lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/admin.ts`).
