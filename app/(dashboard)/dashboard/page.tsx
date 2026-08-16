import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TaskDashboard } from "@/components/tasks/TaskDashboard";
import { LogOut, MessageSquare } from "lucide-react";
import { Task } from "@/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Fetch tasks
  const { data: tasksData } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", user.id)
    .order("completed", { ascending: true })
    .order("deadline", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  const tasks: Task[] = (tasksData as Task[]) || [];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-zinc-800">
      {/* Top Bar */}
      <header className="border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-lg tracking-wider text-white">DELO</span>
            <span className="text-xs text-zinc-400 font-mono bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
              @{profile?.username || user.email?.split("@")[0]}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {profile?.telegram_user_id ? (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-1 rounded-lg">
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Telegram подключен</span>
              </span>
            ) : (
              <a
                href="https://t.me"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 bg-sky-950/30 border border-sky-800/40 px-2.5 py-1 rounded-lg transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Подключить Telegram</span>
              </a>
            )}

            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded-lg border border-zinc-800 hover:bg-zinc-900 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Выйти</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white tracking-tight">Задачи</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Создавайте задачи текстом, через дату или отправляйте голосовые в Telegram
          </p>
        </div>

        {/* Task Management UI */}
        <TaskDashboard initialTasks={tasks} />
      </main>
    </div>
  );
}
