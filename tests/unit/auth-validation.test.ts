import { describe, it, expect } from "vitest";
import { registerSchema, loginSchema } from "@/lib/validation/auth";

describe("Auth Validation Schemas", () => {
  describe("registerSchema", () => {
    it("should accept valid registration input", () => {
      const valid = {
        username: "nikita_dev",
        phone: "+79991234567",
        password: "secretpassword123",
        timezone: "Europe/Chisinau",
      };

      const result = registerSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should accept valid registration without phone", () => {
      const valid = {
        username: "alex99",
        password: "password123",
      };

      const result = registerSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should reject short usernames or invalid characters", () => {
      const shortUser = {
        username: "ab",
        password: "password123",
      };
      expect(registerSchema.safeParse(shortUser).success).toBe(false);

      const invalidChars = {
        username: "user@name!",
        password: "password123",
      };
      expect(registerSchema.safeParse(invalidChars).success).toBe(false);
    });

    it("should reject passwords shorter than 6 chars", () => {
      const shortPass = {
        username: "validuser",
        password: "123",
      };
      expect(registerSchema.safeParse(shortPass).success).toBe(false);
    });
  });

  describe("loginSchema", () => {
    it("should accept username or phone identifier", () => {
      expect(
        loginSchema.safeParse({ identifier: "nikita_dev", password: "pwd" }).success
      ).toBe(true);

      expect(
        loginSchema.safeParse({ identifier: "+79991234567", password: "pwd" }).success
      ).toBe(true);
    });

    it("should reject empty identifier or password", () => {
      expect(loginSchema.safeParse({ identifier: "", password: "pwd" }).success).toBe(false);
      expect(loginSchema.safeParse({ identifier: "user", password: "" }).success).toBe(false);
    });
  });
});
