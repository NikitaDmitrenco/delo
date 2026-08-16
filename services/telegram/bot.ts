import { Bot, InlineKeyboard } from "grammy";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseTaskInput } from "@/services/ai/parser";
import { transcribeAudio } from "@/services/audio/whisper";
import { formatDeadline } from "@/lib/utils/dates";
import crypto from "crypto";

const token = process.env.TELEGRAM_BOT_TOKEN || "placeholder_token";
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const bot = new Bot(token);

/**
 * Register all bot handlers and middlewares.
 */
export function setupBot(botInstance: Bot = bot) {
  // Command: /start
  botInstance.command("start", async (ctx) => {
    const from = ctx.from;
    if (!from) return;

    const admin = createAdminClient();
    const telegramUserId = from.id;
    const telegramUsername = from.username || null;

    try {
      // Check if user already exists with this telegram_user_id
      const { data: profile } = await admin
        .from("profiles")
        .select("*")
        .eq("telegram_user_id", telegramUserId)
        .maybeSingle();

      if (profile) {
        await ctx.reply(
          `Привет, ${from.first_name || "друг"}! Я Delo.\n\n` +
            `Просто напиши или скажи голосом, что нужно сделать — я сам определю задачу и дедлайн.`
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

      const keyboard = new InlineKeyboard();
      if (isHttps) {
        keyboard.url("Создать аккаунт", registerUrl).row();
      }
      keyboard.text("Я создал аккаунт", "check_link_status");

      const text = isHttps
        ? `Привет! Чтобы пользоваться Delo, сначала создай или привяжи аккаунт на сайте.`
        : `Привет! Чтобы пользоваться Delo, сначала создай или привяжи аккаунт на сайте:\n\n👉 [Создать аккаунт](${registerUrl})\n\nПосле регистрации нажми кнопку ниже:`;

      await ctx.reply(text, {
        reply_markup: keyboard,
        parse_mode: "Markdown",
      });
    } catch (error) {
      console.error("Bot /start error:", error);
      await ctx.reply("Произошла ошибка при запуске бота. Попробуй позже.");
    }
  });

  // Callback: check_link_status
  botInstance.callbackQuery("check_link_status", async (ctx) => {
    const from = ctx.from;
    if (!from) return;

    const admin = createAdminClient();
    const telegramUserId = from.id;

    try {
      const { data: profile } = await admin
        .from("profiles")
        .select("*")
        .eq("telegram_user_id", telegramUserId)
        .maybeSingle();

      if (profile) {
        await ctx.answerCallbackQuery({ text: "Аккаунт успешно подключен!" });
        await ctx.reply(
          `✅ Отлично! Твой аккаунт подключён.\n\n` +
            `Теперь можешь отправить мне задачу текстом или голосовым сообщением.`
        );
      } else {
        await ctx.answerCallbackQuery({ text: "Аккаунт пока не найден" });
        await ctx.reply(
          `Я пока не вижу созданного аккаунта. Убедись, что зарегистрировался через кнопку выше, и нажми проверку ещё раз.`
        );
      }
    } catch (error) {
      console.error("Bot callback error:", error);
      await ctx.answerCallbackQuery({ text: "Ошибка при проверке" });
    }
  });

  // Text messages handler
  botInstance.on("message:text", async (ctx) => {
    const from = ctx.from;
    const text = ctx.message.text.trim();

    // Ignore commands like /start /help
    if (text.startsWith("/")) return;

    const admin = createAdminClient();
    const telegramUserId = from.id;

    try {
      // 1. Verify user is linked
      const { data: profile } = await admin
        .from("profiles")
        .select("*")
        .eq("telegram_user_id", telegramUserId)
        .maybeSingle();

      if (!profile) {
        await ctx.reply(
          `Сначала нужно привязать аккаунт Delo. Отправь /start для подключения.`
        );
        return;
      }

      await ctx.replyWithChatAction("typing");

      // 2. Parse task with AI
      const userTimezone = profile.timezone || "Europe/Chisinau";
      const parsed = await parseTaskInput({
        input: text,
        anchorDate: new Date(),
        timezone: userTimezone,
      });

      if (!parsed.title) {
        await ctx.reply("Не смог понять задачу. Попробуй сформулировать её немного конкретнее.");
        return;
      }

      // 3. Save task to Supabase
      const { error: dbError } = await admin.from("tasks").insert({
        user_id: profile.id,
        title: parsed.title,
        deadline: parsed.deadline || null,
        completed: false,
        source: "telegram",
        input_type: "text",
        original_input: text,
      });

      if (dbError) {
        console.error("DB error saving task:", dbError);
        await ctx.reply("Не удалось сохранить задачу. Попробуй ещё раз.");
        return;
      }

      // 4. Send formatted confirmation
      const formattedDate = formatDeadline(parsed.deadline);
      await ctx.reply(
        `✅ Задача добавлена\n\n` +
          `📌 **${parsed.title}**\n` +
          `⏱ Дедлайн: ${formattedDate}`,
        { parse_mode: "Markdown" }
      );
    } catch (error: any) {
      console.error("Bot text handling error:", error);
      await ctx.reply("Не удалось обработать задачу. Попробуй переформулировать её.");
    }
  });

  // Voice messages handler
  botInstance.on("message:voice", async (ctx) => {
    const from = ctx.from;
    const admin = createAdminClient();
    const telegramUserId = from.id;

    try {
      // 1. Verify user is linked
      const { data: profile } = await admin
        .from("profiles")
        .select("*")
        .eq("telegram_user_id", telegramUserId)
        .maybeSingle();

      if (!profile) {
        await ctx.reply(
          `Сначала нужно привязать аккаунт Delo. Отправь /start для подключения.`
        );
        return;
      }

      await ctx.replyWithChatAction("record_voice");

      // 2. Download voice audio from Telegram
      const voice = ctx.message.voice;
      const fileInfo = await ctx.getFile();

      if (!fileInfo.file_path) {
        throw new Error("Не удалось получить путь к аудиофайлу");
      }

      const fileUrl = `https://api.telegram.org/file/bot${token}/${fileInfo.file_path}`;
      const audioResponse = await fetch(fileUrl);
      const arrayBuffer = await audioResponse.arrayBuffer();
      const audioBuffer = Buffer.from(arrayBuffer);

      // 3. Transcribe audio with Whisper
      const transcript = await transcribeAudio(audioBuffer, "voice.oga", "ru");

      if (!transcript || transcript.length < 2) {
        await ctx.reply(
          "Не удалось распознать голосовое сообщение. Попробуй отправить его ещё раз или напиши задачу текстом."
        );
        return;
      }

      // 4. Parse task with AI
      const userTimezone = profile.timezone || "Europe/Chisinau";
      const parsed = await parseTaskInput({
        input: transcript,
        anchorDate: new Date(),
        timezone: userTimezone,
      });

      if (!parsed.title) {
        await ctx.reply("Не смог понять задачу из голосового. Попробуй сформулировать точнее.");
        return;
      }

      // 5. Save task to Supabase
      const { error: dbError } = await admin.from("tasks").insert({
        user_id: profile.id,
        title: parsed.title,
        deadline: parsed.deadline || null,
        completed: false,
        source: "telegram",
        input_type: "voice",
        original_input: transcript,
        transcript: transcript,
      });

      if (dbError) {
        console.error("DB error saving voice task:", dbError);
        await ctx.reply("Не удалось сохранить задачу. Попробуй ещё раз.");
        return;
      }

      // 6. Send confirmation
      const formattedDate = formatDeadline(parsed.deadline);
      await ctx.reply(
        `✅ Задача добавлена из голосового сообщения\n\n` +
          `🎤 _«${transcript}»_\n\n` +
          `📌 **${parsed.title}**\n` +
          `⏱ Дедлайн: ${formattedDate}`,
        { parse_mode: "Markdown" }
      );
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
