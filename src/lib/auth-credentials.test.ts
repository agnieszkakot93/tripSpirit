import { beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import type { AppDatabase } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { makeTestDb, seedUser } from "@/test/route-harness";

import { authorizeCredentials } from "./auth-credentials";

const PASSWORD = "password123";

describe("authorizeCredentials — FR-002 sign in with email and password", () => {
  let db: AppDatabase;

  beforeEach(() => {
    ({ db } = makeTestDb());
  });

  async function seedCredentialsUser(
    userId: string,
    email: string,
    password: string = PASSWORD,
    profile: Partial<{
      name: string | null;
      image: string | null;
      passwordHash: string | null;
    }> = {},
  ) {
    const passwordHash =
      profile.passwordHash === null
        ? null
        : (profile.passwordHash ?? (await hashPassword(password)));

    db.insert(schema.users)
      .values({
        id: userId,
        email,
        name: profile.name ?? null,
        image: profile.image ?? null,
        passwordHash,
      })
      .run();
  }

  it("returns the user profile when email and password are valid", async () => {
    await seedCredentialsUser("u1", "traveler@example.com", PASSWORD, {
      name: "Alex",
      image: "https://example.com/avatar.png",
    });

    const result = await authorizeCredentials(db, {
      email: "traveler@example.com",
      password: PASSWORD,
    });

    expect(result).toEqual({
      id: "u1",
      email: "traveler@example.com",
      name: "Alex",
      image: "https://example.com/avatar.png",
    });
  });

  it("normalizes email with trim and lowercase before lookup", async () => {
    await seedCredentialsUser("u1", "traveler@example.com");

    const result = await authorizeCredentials(db, {
      email: "  TRAVELER@Example.COM  ",
      password: PASSWORD,
    });

    expect(result).toEqual({
      id: "u1",
      email: "traveler@example.com",
      name: undefined,
      image: undefined,
    });
  });

  it("returns null for an unknown email", async () => {
    await seedCredentialsUser("u1", "known@example.com");

    expect(
      await authorizeCredentials(db, {
        email: "unknown@example.com",
        password: PASSWORD,
      }),
    ).toBeNull();
  });

  it("returns null for a wrong password", async () => {
    await seedCredentialsUser("u1", "traveler@example.com");

    expect(
      await authorizeCredentials(db, {
        email: "traveler@example.com",
        password: "wrong-password",
      }),
    ).toBeNull();
  });

  it("returns null when the account has no password hash", async () => {
    seedUser(db, "u1", { email: "oauth-only@example.com" });

    expect(
      await authorizeCredentials(db, {
        email: "oauth-only@example.com",
        password: PASSWORD,
      }),
    ).toBeNull();
  });

  it.each([
    ["missing credentials", undefined],
    ["empty object", {}],
    ["non-string email", { email: 1, password: PASSWORD }],
    ["non-string password", { email: "traveler@example.com", password: 1 }],
    ["blank email", { email: "   ", password: PASSWORD }],
    ["empty password", { email: "traveler@example.com", password: "" }],
    ["missing email", { password: PASSWORD }],
    ["missing password", { email: "traveler@example.com" }],
  ] as const)("returns null for invalid input: %s", async (_label, credentials) => {
    await seedCredentialsUser("u1", "traveler@example.com");

    expect(await authorizeCredentials(db, credentials)).toBeNull();
  });
});
