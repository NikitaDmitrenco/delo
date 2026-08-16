import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { createAdminClient } from "@/lib/supabase/admin";

describe("Database Migration & Supabase Clients", () => {
  it("should have migration 001_initial_schema.sql with proper tables and RLS", () => {
    const migrationPath = path.resolve(__dirname, "../../supabase/migrations/001_initial_schema.sql");
    expect(fs.existsSync(migrationPath)).toBe(true);

    const content = fs.readFileSync(migrationPath, "utf-8");
    
    // Check tables
    expect(content).toContain("create table if not exists public.profiles");
    expect(content).toContain("create table if not exists public.tasks");
    expect(content).toContain("create table if not exists public.telegram_link_tokens");

    // Check RLS enabled
    expect(content).toContain("alter table public.profiles enable row level security;");
    expect(content).toContain("alter table public.tasks enable row level security;");
    expect(content).toContain("alter table public.telegram_link_tokens enable row level security;");

    // Check RLS isolation policies
    expect(content).toContain('create policy "Users can select own tasks"');
    expect(content).toContain('create policy "Users can insert own tasks"');
    expect(content).toContain('create policy "Users can update own tasks"');
    expect(content).toContain('create policy "Users can delete own tasks"');

    // Check Telegram ID index & cascade deletes
    expect(content).toContain("idx_profiles_telegram_user_id");
    expect(content).toContain("on delete cascade");
  });

  it("should instantiate browser and admin clients gracefully", () => {
    const browserClient = createBrowserClient();
    expect(browserClient).toBeDefined();
    expect(browserClient.auth).toBeDefined();

    const adminClient = createAdminClient();
    expect(adminClient).toBeDefined();
    expect(adminClient.auth).toBeDefined();
  });
});
