import { Bot, InlineKeyboard, Keyboard } from "grammy";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseTaskInput } from "@/services/ai/parser";
import { transcribeAudio } from "@/services/audio/whisper";
import { formatDeadline } from "@/lib/utils/dates";
import { findBestMatchingTask } from "@/lib/utils/matching";
import { calculateRemindAt } from "@/services/reminders/calculator";
import { ParsedTaskResult, Task, TaskInputType } from "@/types";
import { addMinutes } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import crypto from "crypto";

const token = process.env.TELEGRAM_BOT_TOKEN || "placeholder_token";
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://delo-dusky.vercel.app";

export const bot = new Bot(token, {
  botInfo: {
    id: 8699808653,
    is_bot: true,
    first_name: "Delo",
    username: "delo_task_bot",
    can_join_groups: true,
    can_read_all_group_messages: false,
    supports_inline_queries: false,
    supports_guest_queries: false,
    can_connect_to_business: false,
    has_main_web_app: false,
    has_topics_enabled: false,
    allows_users_to_create_topics: false,
    can_manage_bots: false,
    supports_join_request_queries: false,
  },
});

/**
 * Escapes HTML characters for safe Telegram HTML formatting.
 */
export function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Normalizes phone numbers to digits only for reliable database matching.
 */
export function normalizePhone(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) {
    return "7" + digits.slice(1);
  }
  return digits;
}

/**
 * Helper to find user profile by telegram_user_id or phone number.
 */
export async function findProfile(telegramUserId: number, rawPhone?: string | null) {
  const admin = createAdminClient();

  // 1. Direct match by telegram_user_id
  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("telegram_user_id", telegramUserId)
    .maybeSingle();

  if (profile) return profile;

  // 2. Match by phone if provided
  if (rawPhone) {
    const cleanInput = normalizePhone(rawPhone);
    if (cleanInput.length >= 7) {
      const { data: allProfiles } = await admin.from("profiles").select("*");
      const matched = allProfiles?.find((p) => p.phone && normalizePhone(p.phone) === cleanInput);

      if (matched) {
        await admin
          .from("profiles")
          .update({ telegram_user_id: telegramUserId })
          .eq("id", matched.id);

        return { ...matched, telegram_user_id: telegramUserId };
      }
    }
  }

  return null;
}

/**
 * Executes the parsed intent action against the user's database.
 */
export async function executeTaskAction(params: {
  ctx: any;
  admin: ReturnType<typeof createAdminClient>;
  profile: any;
  parsed: ParsedTaskResult;
  originalInput: string;
  inputType: TaskInputType;
  userTimezone: string;
  transcript?: string | null;
}) {
  const { ctx, admin, profile, parsed, originalInput, inputType, userTimezone, transcript } = params;

  // 0. Intent: SET REMINDER BUFFER
  if (parsed.intent === "set_reminder_buffer") {
    const bufferMins = parsed.reminderBufferMinutes || 20;
    await admin
      .from("profiles")
      .update({ reminder_buffer_minutes: bufferMins })
      .eq("id", profile.id);

    await ctx.reply(
      `⏱ <b>Буфер напоминаний обновлён!</b>\n\n` +
        `Теперь я буду присылать напоминания за <b>${bufferMins} минут</b> до того, как нужно садиться за работу над задачами.`,
      { parse_mode: "HTML" }
    );
    return;
  }

  // 1. Intent: CREATE TASK
  if (parsed.intent === "create_task") {
    const title = parsed.title || originalInput;
    const durationMins = parsed.estimatedDurationMinutes || 30;
    const bufferMins = profile.reminder_buffer_minutes || 20;
    const remindAt = calculateRemindAt(parsed.deadline, durationMins, bufferMins);

    const { error: dbError } = await admin.from("tasks").insert({
      user_id: profile.id,
      title: title,
      deadline: parsed.deadline || null,
      completed: false,
      source: "telegram",
      input_type: inputType,
      estimated_duration_minutes: durationMins,
      remind_at: remindAt,
      reminder_sent: false,
      original_input: originalInput,
      transcript: transcript || null,
    });

    if (dbError) {
      console.error("DB error saving task:", dbError);
      await ctx.reply("Не удалось сохранить задачу. Попробуй ещё раз.");
      return;
    }

    const formattedDate = formatDeadline(parsed.deadline, userTimezone);
    const prefix = inputType === "voice" ? `🎤 <i>«${escapeHtml(transcript || originalInput)}»</i>\n\n` : "";

    await ctx.reply(
      `✅ <b>Задача добавлена</b>\n\n` +
        prefix +
        `📌 <b>${escapeHtml(title)}</b>\n` +
        `⏱ Дедлайн: <b>${escapeHtml(formattedDate)}</b>`,
      { parse_mode: "HTML" }
    );
    return;
  }

  // For all other actions: Fetch existing user tasks from Supabase
  const { data: tasksData } = await admin
    .from("tasks")
    .select("*")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });

  const tasks: Task[] = (tasksData as Task[]) || [];
  const searchQuery = parsed.targetQuery || parsed.title || originalInput;
  const matchedTask = findBestMatchingTask(tasks, searchQuery, parsed.intent);

  if (!matchedTask) {
    // If the intent was set_deadline on a new task or empty task list, gracefully create the task
    if (parsed.intent === "set_deadline" || tasks.length === 0) {
      const fallbackTitle = parsed.title || originalInput.replace(/(?:^|[^\p{L}\d])(?:перенеси|сдвинь|поставь\s+дедлайн)\s+/giu, "").trim();
      const capTitle = fallbackTitle.charAt(0).toUpperCase() + fallbackTitle.slice(1);
      const durationMins = parsed.estimatedDurationMinutes || 30;
      const bufferMins = profile.reminder_buffer_minutes || 20;
      const remindAt = calculateRemindAt(parsed.deadline, durationMins, bufferMins);

      const { error: dbError } = await admin.from("tasks").insert({
        user_id: profile.id,
        title: capTitle,
        deadline: parsed.deadline || null,
        completed: false,
        source: "telegram",
        input_type: inputType,
        estimated_duration_minutes: durationMins,
        remind_at: remindAt,
        reminder_sent: false,
        original_input: originalInput,
        transcript: transcript || null,
      });

      if (!dbError) {
        const formattedDate = formatDeadline(parsed.deadline, userTimezone);
        const prefix = inputType === "voice" ? `🎤 <i>«${escapeHtml(transcript || originalInput)}»</i>\n\n` : "";
        await ctx.reply(
          `✅ <b>Задача добавлена</b>\n\n` +
            prefix +
            `📌 <b>${escapeHtml(capTitle)}</b>\n` +
            `⏱ Дедлайн: <b>${escapeHtml(formattedDate)}</b>`,
          { parse_mode: "HTML" }
        );
        return;
      }
    }

    await ctx.reply(
      `❌ Не удалось найти подходящую задачу по запросу <i>«${escapeHtml(searchQuery)}»</i>.\n\n` +
        `Проверьте список задач на сайте или назовите задачу точнее.`,
      { parse_mode: "HTML" }
    );
    return;
  }

  // 2. Intent: COMPLETE TASK (Отметить выполненной / галочка)
  if (parsed.intent === "complete_task") {
    await admin.from("tasks").update({ completed: true }).eq("id", matchedTask.id);
    await ctx.reply(
      `✅ <b>Задача отмечена выполненной!</b>\n\n` +
        `📌 <s>${escapeHtml(matchedTask.title)}</s>`,
      { parse_mode: "HTML" }
    );
    return;
  }

  // 3. Intent: UNCOMPLETE TASK (Снять отметку выполнения / вернуть в работу)
  if (parsed.intent === "uncomplete_task") {
    await admin.from("tasks").update({ completed: false }).eq("id", matchedTask.id);
    await ctx.reply(
      `🔄 <b>Задача возвращена в работу!</b>\n\n` +
        `📌 <b>${escapeHtml(matchedTask.title)}</b>`,
      { parse_mode: "HTML" }
    );
    return;
  }

  // 4. Intent: DELETE TASK (Удалить задачу)
  if (parsed.intent === "delete_task") {
    await admin.from("tasks").delete().eq("id", matchedTask.id);
    await ctx.reply(
      `🗑️ <b>Задача удалена</b>\n\n` +
        `📌 <s>${escapeHtml(matchedTask.title)}</s>`,
      { parse_mode: "HTML" }
    );
    return;
  }

  // 5. Intent: SET / UPDATE DEADLINE (Установить / перенести дедлайн)
  if (parsed.intent === "set_deadline") {
    const durationMins = matchedTask.estimated_duration_minutes || 30;
    const bufferMins = profile.reminder_buffer_minutes || 20;
    const remindAt = calculateRemindAt(parsed.deadline, durationMins, bufferMins);

    await admin
      .from("tasks")
      .update({ deadline: parsed.deadline, remind_at: remindAt, reminder_sent: false })
      .eq("id", matchedTask.id);

    const formattedDate = formatDeadline(parsed.deadline, userTimezone);
    await ctx.reply(
      `⏱ <b>Дедлайн обновлён</b>\n\n` +
        `📌 <b>${escapeHtml(matchedTask.title)}</b>\n` +
        `⏱ Новый дедлайн: <b>${escapeHtml(formattedDate)}</b>`,
      { parse_mode: "HTML" }
    );
    return;
  }

  // 6. Intent: REMOVE DEADLINE (Снять дедлайн)
  if (parsed.intent === "remove_deadline") {
    await admin.from("tasks").update({ deadline: null, remind_at: null }).eq("id", matchedTask.id);
    await ctx.reply(
      `⏱ <b>Дедлайн снят</b>\n\n` +
        `📌 <b>${escapeHtml(matchedTask.title)}</b> (Без дедлайна)`,
      { parse_mode: "HTML" }
    );
    return;
  }

  // 7. Intent: EDIT TITLE (Изменить название задачи)
  if (parsed.intent === "edit_title") {
    const newTitle = parsed.title || originalInput;
    await admin.from("tasks").update({ title: newTitle }).eq("id", matchedTask.id);
    await ctx.reply(
      `✏️ <b>Название задачи изменено</b>\n\n` +
        `Было: <i>${escapeHtml(matchedTask.title)}</i>\n` +
        `Стало: <b>${escapeHtml(newTitle)}</b>`,
      { parse_mode: "HTML" }
    );
    return;
  }
}

/**
 * Register all bot handlers and middlewares.
 */
export function setupBot(botInstance: Bot = bot) {
  // Command: /start
  botInstance.command("start", async (ctx) => {
    const from = ctx.from;
    if (!from) return;

    const telegramUserId = from.id;
    const telegramUsername = from.username || null;
    const admin = createAdminClient();

    try {
      const profile = await findProfile(telegramUserId);

      if (profile) {
        await ctx.reply(
          `Привет, ${escapeHtml(from.first_name || "друг")}! Я Delo.\n\n` +
            `Просто напиши или скажи голосом, что нужно сделать — я сам определю действие, задачу и дедлайн.\n\n` +
            `💡 <b>Примеры команд:</b>\n` +
            `• <i>«Завтра в 15:00 созвониться с юристом»</i>\n` +
            `• <i>«Перенеси задачу отчета на послезавтра»</i>\n` +
            `• <i>«Поставь таймер напоминания по умолчанию за 30 минут»</i>\n` +
            `• <i>«Поставь галочку на задаче купить молоко»</i>\n` +
            `• <i>«Удали задачу про договор»</i>`,
          {
            reply_markup: { remove_keyboard: true },
            parse_mode: "HTML",
          }
        );
        return;
      }

      // Unlinked user: generate secure linking token (15m expiration)
      const linkingToken = `delo_${crypto.randomBytes(16).toString("hex")}`;
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      await admin.from("telegram_link_tokens").insert({
        token: linkingToken,
        telegram_user_id: telegramUserId,
        telegram_username: telegramUsername,
        expires_at: expiresAt,
        used: false,
      });

      const registerUrl = `${appUrl}/register?token=${linkingToken}`;
      const isHttps = registerUrl.startsWith("https://");

      const inlineKeyboard = new InlineKeyboard();
      if (isHttps) {
        inlineKeyboard.url("Создать аккаунт на сайте", registerUrl).row();
      }
      inlineKeyboard.text("Я создал аккаунт", "check_link_status");

      const contactKeyboard = new Keyboard()
        .requestContact("📱 Поделиться номером для привязки")
        .resized()
        .oneTime();

      const text = isHttps
        ? `Привет! Чтобы пользоваться Delo, привяжите аккаунт одним из двух способов:\n\n` +
          `1. Нажмите кнопку внизу <b>«📱 Поделиться номером для привязки»</b> (если регистрировались на сайте с номером телефона).\n` +
          `2. Либо перейдите по кнопке ниже и создайте аккаунт на сайте.`
        : `Привет! Чтобы пользоваться Delo, привяжите аккаунт:\n\n` +
          `1. Нажмите кнопку <b>«📱 Поделиться номером для привязки»</b> внизу экрана.\n` +
          `2. Либо перейдите по ссылке: <a href="${registerUrl}">Создать аккаунт на сайте</a>\n\n` +
          `После регистрации нажмите «Я создал аккаунт» ниже.`;

      await ctx.reply(text, {
        reply_markup: contactKeyboard,
        parse_mode: "HTML",
      });

      await ctx.reply("После создания аккаунта на сайте нажмите кнопку подтверждения:", {
        reply_markup: inlineKeyboard,
      });
    } catch (error) {
      console.error("Bot /start error:", error);
      await ctx.reply("Произошла ошибка при запуске бота. Попробуй позже.");
    }
  });

  // Command: /test_reminder (Developer testing command)
  botInstance.command("test_reminder", async (ctx) => {
    const from = ctx.from;
    if (!from) return;

    const telegramUserId = from.id;
    const admin = createAdminClient();

    try {
      const profile = await findProfile(telegramUserId);
      if (!profile) {
        await ctx.reply("Сначала привяжите аккаунт через /start.");
        return;
      }

      const now = new Date();
      const bufferMins = profile.reminder_buffer_minutes || 20;
      const durationMins = 15;

      // Remind at: NOW + 20 seconds
      const remindAt = new Date(now.getTime() + 20 * 1000).toISOString();
      // Deadline: NOW + (buffer + duration) + 20 seconds = NOW + 35 minutes + 20 seconds
      const deadline = new Date(now.getTime() + ((bufferMins + durationMins) * 60 + 20) * 1000).toISOString();

      const userTimezone = profile.timezone || "Europe/Chisinau";
      const formattedDeadline = formatDeadline(deadline, userTimezone);
      const formattedRemindAt = formatInTimeZone(remindAt, userTimezone, "HH:mm:ss");

      const title = "Тестовая задача (Test task)";

      const { error: dbError } = await admin
        .from("tasks")
        .insert({
          user_id: profile.id,
          title: title,
          deadline: deadline,
          estimated_duration_minutes: durationMins,
          remind_at: remindAt,
          reminder_sent: false,
          completed: false,
          source: "telegram",
          input_type: "manual",
          original_input: "/test_reminder",
        });

      if (dbError) {
        console.error("DB error in test_reminder:", dbError);
        await ctx.reply("Ошибка при создании тестовой задачи.");
        return;
      }

      await ctx.reply(
        `🧪 <b>Создана тестовая задача!</b>\n\n` +
          `📌 <b>${escapeHtml(title)}</b>\n` +
          `⏱ Дедлайн: <b>${escapeHtml(formattedDeadline)}</b>\n` +
          `⏳ Время на выполнение: <b>${durationMins} мин</b>\n` +
          `⏰ Буфер напоминания: <b>${bufferMins} мин</b>\n\n` +
          `🔔 <b>Напоминание (remind_at):</b> в <code>${formattedRemindAt}</code> (через 20 сек)`,
        { parse_mode: "HTML" }
      );
    } catch (err) {
      console.error("Error in /test_reminder handler:", err);
      await ctx.reply("Произошла ошибка при запуске теста.");
    }
  });

  // Contact sharing handler: automatic phone verification and matching with database
  botInstance.on("message:contact", async (ctx) => {
    const from = ctx.from;
    const contact = ctx.message.contact;
    if (!from || !contact) return;

    const telegramUserId = from.id;
    const phoneNumber = contact.phone_number;

    try {
      await ctx.replyWithChatAction("typing");

      const profile = await findProfile(telegramUserId, phoneNumber);

      if (profile) {
        const usernameDisplay = profile.username ? `@${escapeHtml(profile.username)}` : "пользователь";
        const phoneDisplay = escapeHtml(profile.phone || phoneNumber);

        await ctx.reply(
          `✅ <b>Аккаунт найден и успешно привязан!</b>\n\n` +
            `👤 Пользователь: <b>${usernameDisplay}</b>\n` +
            `📱 Телефон: <b>${phoneDisplay}</b>\n\n` +
            `Теперь ты можешь управлять задачами текстом или голосовыми сообщениями!`,
          {
            reply_markup: { remove_keyboard: true },
            parse_mode: "HTML",
          }
        );
      } else {
        const linkingToken = `delo_${crypto.randomBytes(16).toString("hex")}`;
        const registerUrl = `${appUrl}/register?token=${linkingToken}`;

        await ctx.reply(
          `❌ Пользователь с номером <b>${escapeHtml(phoneNumber)}</b> пока не зарегистрирован на сайте.\n\n` +
            `Создай аккаунт с этим номером телефона по ссылке:\n` +
            `👉 <a href="${registerUrl}">Зарегистрироваться в Delo</a>`,
          {
            reply_markup: { remove_keyboard: true },
            parse_mode: "HTML",
          }
        );
      }
    } catch (error) {
      console.error("Contact link error:", error);
      await ctx.reply("Произошла ошибка при сверке номера с базой данных.");
    }
  });

  // Callback: check_link_status
  botInstance.callbackQuery("check_link_status", async (ctx) => {
    const from = ctx.from;
    if (!from) return;

    const telegramUserId = from.id;

    try {
      const profile = await findProfile(telegramUserId);

      if (profile) {
        await ctx.answerCallbackQuery({ text: "Аккаунт успешно подключен!" });
        await ctx.reply(
          `✅ <b>Отлично! Твой аккаунт подключён.</b>\n\n` +
            `Теперь можешь отправить мне задачу текстом или голосовым сообщением.`,
          {
            reply_markup: { remove_keyboard: true },
            parse_mode: "HTML",
          }
        );
      } else {
        await ctx.answerCallbackQuery({ text: "Аккаунт пока не найден" });
        await ctx.reply(
          `Я пока не вижу созданного аккаунта.\n` +
            `• Нажми кнопку <b>«📱 Поделиться номером для привязки»</b> внизу экрана\n` +
            `• Либо убедись, что зарегистрировался по ссылке из этого чата.`,
          { parse_mode: "HTML" }
        );
      }
    } catch (error) {
      console.error("Bot callback error:", error);
      await ctx.answerCallbackQuery({ text: "Ошибка при проверке" });
    }
  });

  // Reminder interactive callbacks: Done and Snooze (+30 min)
  botInstance.callbackQuery(/^rem_done:(.+)$/, async (ctx) => {
    const taskId = ctx.match[1];
    const admin = createAdminClient();

    try {
      await admin.from("tasks").update({ completed: true }).eq("id", taskId);
      await ctx.answerCallbackQuery({ text: "Задача выполнена!" });
      await ctx.reply("✅ <b>Отлично! Задача отмечена как выполненная.</b>", { parse_mode: "HTML" });
    } catch (err) {
      console.error("Reminder done callback error:", err);
      await ctx.answerCallbackQuery({ text: "Ошибка" });
    }
  });

  botInstance.callbackQuery(/^rem_snooze:(.+)$/, async (ctx) => {
    const taskId = ctx.match[1];
    const admin = createAdminClient();

    try {
      const { data: task } = await admin.from("tasks").select("*").eq("id", taskId).single();
      if (task) {
        const currentDeadline = task.deadline ? new Date(task.deadline) : new Date();
        const newDeadline = addMinutes(currentDeadline, 30).toISOString();
        const newRemindAt = addMinutes(new Date(), 25).toISOString();

        await admin
          .from("tasks")
          .update({ deadline: newDeadline, remind_at: newRemindAt, reminder_sent: false })
          .eq("id", taskId);

        await ctx.answerCallbackQuery({ text: "Дедлайн перенесён на 30 мин" });
        await ctx.reply("⏱ <b>Дедлайн задачи сдвинут на +30 минут.</b>", { parse_mode: "HTML" });
      }
    } catch (err) {
      console.error("Reminder snooze callback error:", err);
      await ctx.answerCallbackQuery({ text: "Ошибка" });
    }
  });

  // Text messages handler
  botInstance.on("message:text", async (ctx) => {
    const from = ctx.from;
    const text = ctx.message.text.trim();

    if (text.startsWith("/")) return;

    const telegramUserId = from.id;
    const admin = createAdminClient();

    try {
      const profile = await findProfile(telegramUserId);

      if (!profile) {
        await ctx.reply(
          `Сначала нужно привязать аккаунт Delo.\n` +
            `Нажми кнопку <b>«📱 Поделиться номером для привязки»</b> или отправь /start для подключения.`,
          { parse_mode: "HTML" }
        );
        return;
      }

      await ctx.replyWithChatAction("typing");

      const userTimezone = profile.timezone || "Europe/Chisinau";
      const parsed = await parseTaskInput({
        input: text,
        anchorDate: new Date(),
        timezone: userTimezone,
      });

      await executeTaskAction({
        ctx,
        admin,
        profile,
        parsed,
        originalInput: text,
        inputType: "text",
        userTimezone,
      });
    } catch (error: any) {
      console.error("Bot text handling error:", error);
      await ctx.reply("Не удалось обработать задачу. Попробуй переформулировать её.");
    }
  });

  // Voice messages handler
  botInstance.on("message:voice", async (ctx) => {
    const from = ctx.from;
    const telegramUserId = from.id;
    const admin = createAdminClient();

    try {
      const profile = await findProfile(telegramUserId);

      if (!profile) {
        await ctx.reply(
          `Сначала нужно привязать аккаунт Delo.\n` +
            `Нажми кнопку <b>«📱 Поделиться номером для привязки»</b> или отправь /start для подключения.`,
          { parse_mode: "HTML" }
        );
        return;
      }

      await ctx.replyWithChatAction("record_voice");

      const fileInfo = await ctx.getFile();
      if (!fileInfo.file_path) {
        throw new Error("Не удалось получить путь к аудиофайлу");
      }

      const fileUrl = `https://api.telegram.org/file/bot${token}/${fileInfo.file_path}`;
      const audioResponse = await fetch(fileUrl);
      const arrayBuffer = await audioResponse.arrayBuffer();
      const audioBuffer = Buffer.from(arrayBuffer);

      const transcript = await transcribeAudio(audioBuffer, "voice.oga", "ru");
      if (!transcript || transcript.length < 2) {
        await ctx.reply(
          "Не удалось распознать голосовое сообщение. Попробуй отправить его ещё раз или напиши задачу текстом."
        );
        return;
      }

      const userTimezone = profile.timezone || "Europe/Chisinau";
      const parsed = await parseTaskInput({
        input: transcript,
        anchorDate: new Date(),
        timezone: userTimezone,
      });

      await executeTaskAction({
        ctx,
        admin,
        profile,
        parsed,
        originalInput: transcript,
        inputType: "voice",
        userTimezone,
        transcript,
      });
    } catch (error: any) {
      console.error("Bot voice handling error:", error);
      await ctx.reply(
        "Не удалось распознать голосовое сообщение. Попробуй отправить его ещё раз или напиши задачу текстом."
      );
    }
  });

  return botInstance;
}

// Setup default instance handlers
setupBot(bot);
