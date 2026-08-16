import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { bot } from "../services/telegram/bot";

async function runDevBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token || token.includes("placeholder")) {
    console.warn("\n⚠️  TELEGRAM_BOT_TOKEN не настроен в .env.local.");
    console.warn("Укажите токен вашего бота от @BotFather для запуска локального поллинга.\n");
    process.exit(1);
  }

  console.log("🚀 Запуск Telegram-бота Delo в режиме long polling...");

  // Drop pending updates to avoid backlog on local restart
  await bot.init();
  console.log(`🤖 Бот авторизован как @${bot.botInfo.username}`);

  await bot.start({
    onStart: (info) => {
      console.log(`✨ Бот @${info.username} успешно слушает сообщения.`);
    },
  });
}

runDevBot().catch((err) => {
  console.error("Ошибка запуска бота:", err);
  process.exit(1);
});
