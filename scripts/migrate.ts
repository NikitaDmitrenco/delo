import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function runMigration() {
  const sql = fs.readFileSync(
    path.join(process.cwd(), "supabase", "migrations", "002_predictive_reminders.sql"),
    "utf-8"
  );

  console.log("Applying Migration 002...");

  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  console.log("RPC exec_sql status:", res.status, await res.text());
}

runMigration().catch(console.error);
