import { Bot, InlineKeyboard, Keyboard } from "grammy";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseTaskInput } from "@/services/ai/parser";
import { transcribeAudio } from "@/services/audio/whisper";
import { formatDeadline } from "@/lib/utils/dates";
import crypto from "crypto";

const token = process.env.TELEGRAM_BOT_TOKEN || "placeholder_token";
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const bot = new Bot(token);

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
  // If starts with 8 and length is 11 (Russian format), normalize to 7
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
        // Link this telegram_user_id to the found profile in database
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
      // Check if user is already linked
      const profile = await findProfile(telegramUserId);

      if (profile) {
        await ctx.reply(
          `Привет, ${escapeHtml(from.first_name || "друг")}! Я Delo.\n\n` +
            `Просто напиши или скажи голосом, что нужно сделать — я сам определю задачу и дедлайн.`,
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

      // Inline keyboard for web registration
      const inlineKeyboard = new InlineKeyboard();
      if (isHttps) {
        inlineKeyboard.url("Создать аккаунт на сайте", registerUrl).row();
      }
      inlineKeyboard.text("Я создал аккаунт", "check_link_status");

      // Reply keyboard with 1-click Contact Sharing
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

      // Send inline button for verification
      await ctx.reply("После создания аккаунта на сайте нажмите кнопку подтверждения:", {
        reply_markup: inlineKeyboard,
      });
    } catch (error) {
      console.error("Bot /start error:", error);
      await ctx.reply("Произошла ошибка при запуске бота. Попробуй позже.");
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

      // Search and link profile by phone number
      const profile = await findProfile(telegramUserId, phoneNumber);

      if (profile) {
        const usernameDisplay = profile.username ? `@${escapeHtml(profile.username)}` : "пользователь";
        const phoneDisplay = escapeHtml(profile.phone || phoneNumber);

        await ctx.reply(
          `✅ <b>Аккаунт найден и успешно привязан!</b>\n\n` +
            `👤 Пользователь: <b>${usernameDisplay}</b>\n` +
            `📱 Телефон: <b>${phoneDisplay}</b>\n\n` +
            `Теперь ты можешь отправлять мне задачи текстом или голосовым сообщением.`,
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

  // Text messages handler
  botInstance.on("message:text", async (ctx) => {
    const from = ctx.from;
    const text = ctx.message.text.trim();

    // Ignore commands like /start /help
    if (text.startsWith("/")) return;

    const telegramUserId = from.id;
    const admin = createAdminClient();

    try {
      // 1. Verify user is linked in database
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
        `✅ <b>Задача добавлена</b>\n\n` +
          `📌 <b>${escapeHtml(parsed.title)}</b>\n` +
          `⏱ Дедлайн: <b>${escapeHtml(formattedDate)}</b>`,
        { parse_mode: "HTML" }
      );
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
      // 1. Verify user is linked in database
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

      // 2. Download voice audio from Telegram
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
        `✅ <b>Задача добавлена из голосового сообщения</b>\n\n` +
          `🎤 <i>«${escapeHtml(transcript)}»</i>\n\n` +
          `📌 <b>${escapeHtml(parsed.title)}</b>\n` +
          `⏱ Дедлайн: <b>${escapeHtml(formattedDate)}</b>`,
        { parse_mode: "HTML" }
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
