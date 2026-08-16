-- ==============================================================================
-- DELO — Supabase Initial Database Schema & Security Policies
-- Migration: 001_initial_schema.sql
-- ==============================================================================

-- 1. Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 2. Profiles Table (extends Supabase auth.users)
-- ------------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  phone text unique,
  telegram_user_id bigint unique,
  telegram_username text,
  timezone text not null default 'Europe/Chisinau',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on table public.profiles is 'User profile information linked to Supabase Auth';

-- ------------------------------------------------------------------------------
-- 3. Tasks Table
-- ------------------------------------------------------------------------------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  deadline timestamp with time zone,
  completed boolean not null default false,
  source text not null default 'web' check (source in ('telegram', 'web')),
  input_type text not null default 'manual' check (input_type in ('text', 'voice', 'manual')),
  original_input text,
  transcript text,
  ai_metadata jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on table public.tasks is 'User tasks created via Web UI or Telegram Bot';

-- ------------------------------------------------------------------------------
-- 4. Telegram Link Tokens Table
-- ------------------------------------------------------------------------------
create table if not exists public.telegram_link_tokens (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  telegram_user_id bigint not null,
  telegram_username text,
  expires_at timestamp with time zone not null,
  used boolean not null default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on table public.telegram_link_tokens is 'Single-use cryptographic tokens for linking Telegram accounts to Delo accounts';

-- ------------------------------------------------------------------------------
-- 5. Indexes for Performance & Search
-- ------------------------------------------------------------------------------
create index if not exists idx_profiles_telegram_user_id on public.profiles(telegram_user_id);
create index if not exists idx_profiles_username on public.profiles(username);
create index if not exists idx_profiles_phone on public.profiles(phone);

create index if not exists idx_tasks_user_id on public.tasks(user_id);
create index if not exists idx_tasks_completed on public.tasks(completed);
create index if not exists idx_tasks_deadline on public.tasks(deadline);
create index if not exists idx_tasks_user_id_completed on public.tasks(user_id, completed);

create index if not exists idx_telegram_link_tokens_token on public.telegram_link_tokens(token);
create index if not exists idx_telegram_link_tokens_telegram_user_id on public.telegram_link_tokens(telegram_user_id);

-- ------------------------------------------------------------------------------
-- 6. Trigger: Updated At Timestamp Automation
-- ------------------------------------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
  before update on public.tasks
  for each row execute function public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 7. Trigger: Automatically Create Profile on Auth Signup
-- ------------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (
    id,
    username,
    phone,
    timezone
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'phone',
    coalesce(new.raw_user_meta_data->>'timezone', 'Europe/Chisinau')
  )
  on conflict (id) do update set
    username = excluded.username,
    phone = coalesce(excluded.phone, profiles.phone),
    updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 8. Row Level Security (RLS) Policies
-- ------------------------------------------------------------------------------

-- Enable RLS on all user-facing tables
alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.telegram_link_tokens enable row level security;

-- Profiles RLS Policies:
-- Users can view their own profile
create policy "Users can view own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

-- Users can update their own profile
create policy "Users can update own profile"
  on public.profiles
  for update
  using (auth.uid() = id);

-- Tasks RLS Policies:
-- Users can view only their own tasks
create policy "Users can select own tasks"
  on public.tasks
  for select
  using (auth.uid() = user_id);

-- Users can insert tasks for themselves
create policy "Users can insert own tasks"
  on public.tasks
  for insert
  with check (auth.uid() = user_id);

-- Users can update only their own tasks
create policy "Users can update own tasks"
  on public.tasks
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users can delete only their own tasks
create policy "Users can delete own tasks"
  on public.tasks
  for delete
  using (auth.uid() = user_id);

-- Telegram Link Tokens RLS:
-- Tokens are managed via Service Role / RPC, authenticated users can read token for linking validation
create policy "Authenticated users can read valid tokens"
  on public.telegram_link_tokens
  for select
  to authenticated
  using (not used and expires_at > timezone('utc'::text, now()));
