import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { users, verificationTokens } from "@/db/schema";
import type { AppDatabase } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  seedResetToken,
  seedUser,
  setupRouteTest,
} from "@/test/route-harness";

vi.mock("@/lib/db", async () => {
  const harness = await import("@/test/route-harness");
  return { getDb: harness.mockGetDb };
});

import { POST } from "./route";

const EMAIL = "alice@example.com";
const OLD_PASSWORD = "correct-password-1";
const NEW_PASSWORD = "new-password-99";
const INVALID_LINK = { error: "Invalid or expired reset link" };

let oldHash: string;

beforeAll(async () => {
  oldHash = await hashPassword(OLD_PASSWORD);
});

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function tokenCount(db: AppDatabase, token: string) {
  const rows = await db
    .select()
    .from(verificationTokens)
    .where(eq(verificationTokens.token, token))
    .all();
  return rows.length;
}

async function userPasswordHash(db: AppDatabase, email: string) {
  const rows = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email))
    .all();
  return rows[0]?.passwordHash ?? null;
}

describe("POST /api/auth/reset-password — token abuse (Risk #4)", () => {
  let db: AppDatabase;

  beforeEach(() => {
    ({ db } = setupRouteTest());
    seedUser(db, "u1", { email: EMAIL, passwordHash: oldHash });
  });

  it("returns the same 400 for forged, expired, and reused tokens", async () => {
    const expiredToken = seedResetToken(db, EMAIL, {
      expires: new Date(Date.now() - 60_000),
    });
    const liveToken = seedResetToken(db, EMAIL);

    const forged = await POST(
      jsonRequest({ token: "forged-not-in-db", password: NEW_PASSWORD }),
    );
    const expired = await POST(
      jsonRequest({ token: expiredToken, password: NEW_PASSWORD }),
    );

    const firstUse = await POST(
      jsonRequest({ token: liveToken, password: NEW_PASSWORD }),
    );
    expect(firstUse.status).toBe(200);

    const reused = await POST(
      jsonRequest({ token: liveToken, password: "another-password-1" }),
    );

    expect(forged.status).toBe(400);
    expect(expired.status).toBe(400);
    expect(reused.status).toBe(400);
    expect(await forged.json()).toEqual(INVALID_LINK);
    expect(await expired.json()).toEqual(INVALID_LINK);
    expect(await reused.json()).toEqual(INVALID_LINK);
  });

  it("on success updates password_hash, removes the token, and returns 200", async () => {
    const token = seedResetToken(db, EMAIL);

    const res = await POST(
      jsonRequest({ token, password: NEW_PASSWORD }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    expect(await tokenCount(db, token)).toBe(0);

    const stored = await userPasswordHash(db, EMAIL);
    expect(stored).toBeTruthy();
    expect(await verifyPassword(NEW_PASSWORD, stored!)).toBe(true);
    expect(await verifyPassword(OLD_PASSWORD, stored!)).toBe(false);
  });

  it("returns 400 for missing token or short password", async () => {
    const missingToken = await POST(
      jsonRequest({ password: NEW_PASSWORD }),
    );
    expect(missingToken.status).toBe(400);
    expect(await missingToken.json()).toEqual(INVALID_LINK);

    const short = await POST(
      jsonRequest({ token: "any-token", password: "short" }),
    );
    expect(short.status).toBe(400);
    expect(await short.json()).toEqual({
      error: "Password must be at least 8 characters",
    });
  });
});
