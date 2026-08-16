import { describe, it, expect } from "vitest";
import { bot, setupBot } from "@/services/telegram/bot";

describe("Telegram Bot Configuration", () => {
  it("should initialize grammY bot instance properly", () => {
    expect(bot).toBeDefined();
    expect(typeof bot.command).toBe("function");
    expect(typeof bot.on).toBe("function");
    expect(typeof bot.callbackQuery).toBe("function");
  });

  it("setupBot should configure without throwing", () => {
    expect(() => setupBot(bot)).not.toThrow();
  });
});
