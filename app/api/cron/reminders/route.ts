import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bot, escapeHtml } from "@/services/telegram/bot";
import { formatDeadline } from "@/lib/utils/dates";
import { InlineKeyboard } from "grammy";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const admin = createAdminClient();
    const nowIso = new Date().toISOString();

    // 1. Fetch uncompleted tasks where remind_at has arrived and reminder was not sent yet
    const { data: tasks, error: fetchError } = await admin
      .from("tasks")
      .select("*, profiles!inner(telegram_user_id, timezone, reminder_buffer_minutes)")
      .eq("completed", false)
      .eq("reminder_sent", false)
      .lte("remind_at", nowIso)
      .limit(50);

    if (fetchError) {
      console.error("Cron reminders fetch error:", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!tasks || tasks.length === 0) {
      return NextResponse.json({ success: true, processed: 0, message: "No pending reminders" });
    }

    let processedCount = 0;

    for (const task of tasks) {
      const profile = task.profiles as any;
      const telegramUserId = profile?.telegram_user_id;

      if (!telegramUserId) {
        // Mark as sent so we don't query it again
        await admin.from("tasks").update({ reminder_sent: true }).eq("id", task.id);
        continue;
      }

      const timezone = profile?.timezone || "Europe/Chisinau";
      const formattedDeadline = formatDeadline(task.deadline, timezone);
      const durationMins = task.estimated_duration_minutes || 30;
      const bufferMins = profile?.reminder_buffer_minutes || 20;

      // Inline action buttons
      const keyboard = new InlineKeyboard()
        .text("✅ Сделано", `rem_done:${task.id}`)
        .text("⏱ +30 мин", `rem_snooze:${task.id}`);

      const messageText =
        `🔔 <b>Подготовка к задаче!</b>\n\n` +
        `📌 <b>${escapeHtml(task.title)}</b>\n` +
        `⏱ Дедлайн: <b>${escapeHtml(formattedDeadline)}</b>\n\n` +
        `⏳ <i>Тайминг:</i>\n` +
        `• Через <b>${bufferMins} мин</b> пора приступить к работе.\n` +
        `• Оценка задачи: <b>~${durationMins} мин</b>.`;

      try {
        await bot.api.sendMessage(telegramUserId, messageText, {
          parse_mode: "HTML",
          reply_markup: keyboard,
        });

        await admin.from("tasks").update({ reminder_sent: true }).eq("id", task.id);
        processedCount++;
      } catch (sendError) {
        console.error(`Failed to send reminder for task ${task.id} to user ${telegramUserId}:`, sendError);
      }
    }

    return NextResponse.json({ success: true, processed: processedCount });
  } catch (error: any) {
    console.error("Cron reminder route error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
