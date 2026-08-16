import { describe, it, expect } from "vitest";
import { bot, setupBot, normalizePhone } from "@/services/telegram/bot";

describe("Telegram Bot Configuration & Phone Matching", () => {
  it("should initialize grammY bot instance properly", () => {
    expect(bot).toBeDefined();
    expect(typeof bot.command).toBe("function");
    expect(typeof bot.on).toBe("function");
    expect(typeof bot.callbackQuery).toBe("function");
  });

  it("setupBot should configure without throwing", () => {
    expect(() => setupBot(bot)).not.toThrow();
  });

  it("should normalize Russian and international phone numbers accurately", () => {
    expect(normalizePhone("+7 (999) 123-45-67")).toBe("79991234567");
    expect(normalizePhone("89991234567")).toBe("79991234567");
    expect(normalizePhone("+373 69 123456")).toBe("37369123456");
    expect(normalizePhone("79991234567")).toBe("79991234567");
  });
});
