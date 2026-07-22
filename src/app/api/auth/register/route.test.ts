import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { users } from "@/db/schema";
import type { AppDatabase } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { seedUser, setupRouteTest } from "@/test/route-harness";

vi.mock("@/lib/db", async () => {
  const harness = await import("@/test/route-harness");
  return { getDb: harness.mockGetDb };
});

import { POST } from "./route";

const PASSWORD = "password123";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function rawRequest(body: string) {
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

async function findUserByEmail(db: AppDatabase, email: string) {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .all();
  return rows[0] ?? null;
}

async function countUsers(db: AppDatabase) {
  const rows = await db.select({ id: users.id }).from(users).all();
  return rows.length;
}

describe("POST /api/auth/register", () => {
  let db: AppDatabase;

  beforeEach(() => {
    ({ db } = setupRouteTest());
  });

  it("returns 400 for invalid JSON", async () => {
    const res = await POST(rawRequest("{"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid JSON body" });
    expect(await countUsers(db)).toBe(0);
  });

  it("returns 400 when email or password is missing or wrong type", async () => {
    const missingEmail = await POST(jsonRequest({ password: PASSWORD }));
    expect(missingEmail.status).toBe(400);
    expect(await missingEmail.json()).toEqual({
      error: "Email and password are required",
    });

    const missingPassword = await POST(jsonRequest({ email: "a@b.com" }));
    expect(missingPassword.status).toBe(400);

    const wrongTypes = await POST(
      jsonRequest({ email: 1, password: true }),
    );
    expect(wrongTypes.status).toBe(400);
    expect(await countUsers(db)).toBe(0);
  });

  it("returns 400 for invalid email shape", async () => {
    const res = await POST(jsonRequest({ email: "not-an-email", password: PASSWORD }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid email" });
    expect(await countUsers(db)).toBe(0);
  });

  it("returns 400 when password is shorter than 8 characters", async () => {
    const res = await POST(jsonRequest({ email: "a@b.com", password: "short" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Password must be at least 8 characters",
    });
    expect(await countUsers(db)).toBe(0);
  });

  it("returns 409 for duplicate email and leaves the existing row unchanged", async () => {
    seedUser(db, "existing-u1", { email: "alice@example.com" });

    const res = await POST(
      jsonRequest({ email: "alice@example.com", password: PASSWORD }),
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "An account with this email already exists",
    });
    expect(await countUsers(db)).toBe(1);
    expect(await findUserByEmail(db, "alice@example.com")).toMatchObject({
      id: "existing-u1",
    });
  });

  it("returns 409 for duplicate email after normalization", async () => {
    seedUser(db, "existing-u1", { email: "alice@example.com" });

    const res = await POST(
      jsonRequest({ email: "  Alice@Example.COM  ", password: PASSWORD }),
    );
    expect(res.status).toBe(409);
    expect(await countUsers(db)).toBe(1);
  });

  it("returns 201 and persists a user with normalized email and hashed password", async () => {
    const res = await POST(
      jsonRequest({
        email: "  New.User@Example.COM  ",
        password: PASSWORD,
        name: "  Ada  ",
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { ok: boolean; userId: string };
    expect(body.ok).toBe(true);
    expect(body.userId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );

    const row = await findUserByEmail(db, "new.user@example.com");
    expect(row).toMatchObject({
      id: body.userId,
      email: "new.user@example.com",
      name: "Ada",
    });
    expect(row?.passwordHash).toBeTruthy();
    expect(await verifyPassword(PASSWORD, row!.passwordHash!)).toBe(true);
    expect(await countUsers(db)).toBe(1);
  });

  it("stores null name when name is omitted or blank", async () => {
    const omitted = await POST(
      jsonRequest({ email: "omit@example.com", password: PASSWORD }),
    );
    expect(omitted.status).toBe(201);
    const omittedBody = (await omitted.json()) as { userId: string };
    const omittedRow = await findUserByEmail(db, "omit@example.com");
    expect(omittedRow?.name).toBeNull();

    const blank = await POST(
      jsonRequest({
        email: "blank@example.com",
        password: PASSWORD,
        name: "   ",
      }),
    );
    expect(blank.status).toBe(201);
    const blankRow = await findUserByEmail(db, "blank@example.com");
    expect(blankRow?.name).toBeNull();
    expect(omittedBody.userId).not.toBe(blankRow?.id);
  });
});
