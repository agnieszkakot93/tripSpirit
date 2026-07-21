import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { verificationTokens } from "@/db/schema";
import type { AppDatabase } from "@/lib/db";
import { seedUser, setupRouteTest } from "@/test/route-harness";

const { mockSendPasswordResetEmail } = vi.hoisted(() => ({
  mockSendPasswordResetEmail: vi.fn(),
}));

vi.mock("@/lib/db", async () => {
  const harness = await import("@/test/route-harness");
  return { getDb: harness.mockGetDb };
});

vi.mock("@/lib/email", () => ({
  sendPasswordResetEmail: mockSendPasswordResetEmail,
}));

vi.mock("@/lib/cloudflare-context", () => ({
  getAppCloudflareContext: async () => ({
    env: { AUTH_URL: "https://example.test" },
    cf: {},
    ctx: {},
  }),
}));

import { POST } from "./route";

const KNOWN_EMAIL = "alice@example.com";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function rawRequest(body: string) {
  return new Request("http://localhost/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

async function countTokensFor(db: AppDatabase, email: string) {
  const rows = await db
    .select()
    .from(verificationTokens)
    .where(eq(verificationTokens.identifier, email))
    .all();
  return rows.length;
}

describe("POST /api/auth/forgot-password — response parity (Risk #4)", () => {
  let db: AppDatabase;

  beforeEach(() => {
    ({ db } = setupRouteTest());
    mockSendPasswordResetEmail.mockReset();
    mockSendPasswordResetEmail.mockResolvedValue(undefined);
  });

  it("returns identical 200 { ok: true } for known email, unknown email, and send failure", async () => {
    seedUser(db, "u1", { email: KNOWN_EMAIL });

    const known = await POST(jsonRequest({ email: KNOWN_EMAIL }));
    const unknown = await POST(jsonRequest({ email: "nobody@example.com" }));

    mockSendPasswordResetEmail.mockRejectedValueOnce(new Error("Resend 500"));
    const sendFail = await POST(jsonRequest({ email: KNOWN_EMAIL }));

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(sendFail.status).toBe(200);
    expect(await known.json()).toEqual({ ok: true });
    expect(await unknown.json()).toEqual({ ok: true });
    expect(await sendFail.json()).toEqual({ ok: true });
  });

  it("creates a reset token only when the email is known and send succeeds", async () => {
    seedUser(db, "u1", { email: KNOWN_EMAIL });

    await POST(jsonRequest({ email: "nobody@example.com" }));
    expect(await countTokensFor(db, "nobody@example.com")).toBe(0);

    await POST(jsonRequest({ email: KNOWN_EMAIL }));
    expect(await countTokensFor(db, KNOWN_EMAIL)).toBe(1);
    expect(mockSendPasswordResetEmail).toHaveBeenCalledOnce();
  });

  it("returns 400 for invalid JSON or invalid email shape (not an existence oracle)", async () => {
    const badJson = await POST(rawRequest("{"));
    expect(badJson.status).toBe(400);
    expect(await badJson.json()).toEqual({ error: "Invalid JSON body" });

    const badEmail = await POST(jsonRequest({ email: "not-an-email" }));
    expect(badEmail.status).toBe(400);
    expect(await badEmail.json()).toEqual({ error: "Valid email is required" });
  });
});
