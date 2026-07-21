import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { users, verificationTokens } from "@/db/schema";
import type { AppDatabase } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import {
  seedResetToken,
  seedUser,
  setupRouteTest,
  type MockSession,
} from "@/test/route-harness";

vi.mock("@/lib/auth", async () => {
  const harness = await import("@/test/route-harness");
  return { auth: harness.mockAuth };
});

vi.mock("@/lib/db", async () => {
  const harness = await import("@/test/route-harness");
  return { getDb: harness.mockGetDb };
});

import { DELETE } from "./route";

const USER_ID = "u1";
const EMAIL = "alice@example.com";
const CORRECT_PASSWORD = "correct-password-1";

let passwordHash: string;

beforeAll(async () => {
  passwordHash = await hashPassword(CORRECT_PASSWORD);
});

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/auth/delete-account", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function findUser(db: AppDatabase, userId: string) {
  const rows = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .all();
  return rows[0] ?? null;
}

async function tokensForEmail(db: AppDatabase, email: string) {
  const rows = await db
    .select()
    .from(verificationTokens)
    .where(eq(verificationTokens.identifier, email))
    .all();
  return rows.length;
}

describe("DELETE /api/auth/delete-account — auth order (Risk #4 / #5)", () => {
  let db: AppDatabase;
  let setSession: (session: MockSession) => void;

  beforeEach(() => {
    ({ db, setSession } = setupRouteTest());
    seedUser(db, USER_ID, { email: EMAIL, passwordHash });
  });

  it("returns 401 Unauthorized when unauthenticated and leaves the user row (Risk #5)", async () => {
    setSession(null);
    const res = await DELETE(jsonRequest({ password: CORRECT_PASSWORD }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
    expect(await findUser(db, USER_ID)).toEqual({ id: USER_ID, email: EMAIL });
  });

  it("returns 403 on wrong password and leaves the user row unchanged (Risk #4)", async () => {
    setSession({ user: { id: USER_ID } });
    const res = await DELETE(jsonRequest({ password: "wrong-password-1" }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Invalid password" });
    expect(await findUser(db, USER_ID)).toEqual({ id: USER_ID, email: EMAIL });
  });

  it("returns 200, deletes the user, and cleans verification tokens on correct password", async () => {
    setSession({ user: { id: USER_ID } });
    seedResetToken(db, EMAIL);

    const res = await DELETE(jsonRequest({ password: CORRECT_PASSWORD }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    expect(await findUser(db, USER_ID)).toBeNull();
    expect(await tokensForEmail(db, EMAIL)).toBe(0);
  });

  it("returns 400 when password is missing", async () => {
    setSession({ user: { id: USER_ID } });
    const res = await DELETE(jsonRequest({}));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Password is required" });
    expect(await findUser(db, USER_ID)).toEqual({ id: USER_ID, email: EMAIL });
  });
});
