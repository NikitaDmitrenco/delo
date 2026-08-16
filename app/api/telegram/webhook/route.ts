import { webhookCallback } from "grammy";
import { bot } from "@/services/telegram/bot";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// Vercel / Next.js Route Handler for Telegram Webhook
export async function POST(req: Request) {
  try {
    const secretToken = req.headers.get("x-telegram-bot-api-secret-token");
    const configuredSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

    // Validate secret token if configured
    if (configuredSecret && secretToken !== configuredSecret) {
      return new Response("Unauthorized", { status: 401 });
    }

    return await webhookCallback(bot, "std/http")(req);
  } catch (error) {
    console.error("Telegram webhook error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function GET() {
  return new Response("Telegram Webhook Endpoint is Active", { status: 200 });
}
