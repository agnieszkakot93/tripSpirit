import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password";

describe("password hashing — FR-002 sign-in credential verification", () => {
  it("accepts the correct password for a freshly hashed value", async () => {
    const hash = await hashPassword("correct-horse-battery");
    expect(await verifyPassword("correct-horse-battery", hash)).toBe(true);
  });

  it("rejects a wrong password without throwing", async () => {
    const hash = await hashPassword("secret-password");
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("rejects malformed stored hashes", async () => {
    expect(await verifyPassword("any", "not-a-valid-hash")).toBe(false);
    expect(await verifyPassword("any", "v1.scrypt:zz:nothex")).toBe(false);
    expect(await verifyPassword("any", "")).toBe(false);
  });
});
