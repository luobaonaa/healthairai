import { describe, expect, it } from "vitest";
import { hashLocalPassword, normalizeLocalEmail, verifyLocalPassword } from "./localAccounts";

describe("local account password helpers", () => {
  it("normalizes email and validates only the matching password", async () => {
    const passwordHash = await hashLocalPassword("KataSandiAman123");
    expect(normalizeLocalEmail("  USER@Example.COM ")).toBe("user@example.com");
    await expect(verifyLocalPassword("KataSandiAman123", passwordHash)).resolves.toBe(true);
    await expect(verifyLocalPassword("salah-password", passwordHash)).resolves.toBe(false);
  });
});
