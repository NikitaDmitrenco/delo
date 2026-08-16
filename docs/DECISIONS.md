# DELO — Architecture Decision Records (ADRs)

This document records all significant technical and design decisions made throughout the lifecycle of Delo.

---

## ADR-001: Technology Stack Selection
- **Date**: 2026-08-16
- **Status**: Accepted
- **Context**: Need a robust, full-stack, scalable, modern, and rapid development framework supporting server-side rendering, API routes (webhooks), database integration, and high performance.
- **Decision**: 
  - **Framework**: Next.js 15+ (App Router) + React 19 + TypeScript.
  - **Styling**: Tailwind CSS v4 for clean, flexible, and responsive UI.
  - **Database & Auth**: Supabase (PostgreSQL + Supabase Auth + RLS).
  - **Telegram Bot**: `grammY` (modern, typed TypeScript framework with pluggable runner for local long-polling and edge webhook support).
  - **AI Model**: OpenAI `gpt-4o-mini` with Structured Outputs (`zod` schema) and OpenAI `whisper-1` for STT.
  - **Test Runner**: Vitest for ultra-fast, modern ESM/TypeScript unit and integration testing.
- **Alternatives Considered**: 
  - *Express/Fastify + React SPA*: Requires managing two separate servers/deployments instead of unified Next.js fullstack.
  - *Telegraf*: Older, grammY has superior TypeScript typing and modular design.

---

## ADR-002: Immutable Telegram Identity & Linking Mechanism
- **Date**: 2026-08-16
- **Status**: Accepted
- **Context**: Telegram usernames (`@username`) can be changed or omitted by users at any time. We need a permanent, stable link between a Telegram account and a Delo account.
- **Decision**: 
  - Use Telegram's numeric `telegram_user_id` (`bigint`) as the immutable anchor.
  - Linking flow uses cryptographically secure single-use tokens stored in `telegram_link_tokens` with a short expiration (15 minutes).
  - Web application receives token upon user registration/login and securely associates the authenticated `user_id` with `telegram_user_id`.
- **Alternatives Considered**: 
  - *Manual username entry*: Vulnerable to impersonation and fragile if username changes.

---

## ADR-003: Strict AI Date Normalization with User Timezone
- **Date**: 2026-08-16
- **Status**: Accepted
- **Context**: Natural language inputs like *"tomorrow at 3pm"* depend entirely on user timezone. Using server UTC creates incorrect deadlines.
- **Decision**:
  - The AI extraction prompt receives the current anchor timestamp and the user's specific timezone (e.g., `Europe/Chisinau`).
  - Output is strictly formatted to ISO-8601 UTC.
  - AI is explicitly instructed **never to invent a deadline** if not mentioned or implied.
- **Alternatives Considered**:
  - *Server-side regex parsing*: Brittle with complex Russian natural language variations.

---

## ADR-004: Supabase Row Level Security (RLS) & Client Architecture
- **Date**: 2026-08-16
- **Status**: Accepted
- **Context**: Strict multi-tenant data isolation is required so that no user can access or modify another user's tasks or profile.
- **Decision**:
  - Enforce Postgres RLS on `profiles`, `tasks`, and `telegram_link_tokens`.
  - Provide typed client constructors: `lib/supabase/client.ts` (browser), `lib/supabase/server.ts` (SSR with async cookies), and `lib/supabase/admin.ts` (service_role for Telegram bot and background jobs).
  - All web mutations must pass through authenticated user sessions matching `auth.uid() = user_id`.
- **Alternatives Considered**:
  - *Application-level filtering*: Risk of accidental data leakage if an endpoint omits `where user_id = ...`.
