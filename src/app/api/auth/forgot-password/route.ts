import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { users } from "@/db/schema";
import { createPasswordResetToken } from "@/lib/auth-tokens";
import { getAppCloudflareContext } from "@/lib/cloudflare-context";
import { getDb } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(request: Request) {
  let body: { email?: unknown };
  try {
    body = (await request.json()) as { email?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const emailRaw = body.email;
  if (typeof emailRaw !== "string" || !emailRaw.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  const email = emailRaw.trim().toLowerCase();

  // Always return { ok: true } regardless of whether the account exists OR
  // whether token creation / email delivery fails. A thrown error here (e.g. a
  // provider 5xx) would surface a 500 *only for registered emails*, turning
  // this into an account-enumeration oracle — so swallow failures and log them
  // server-side instead.
  try {
    const db = await getDb();
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (user) {
      const { env } = await getAppCloudflareContext();
      const token = await createPasswordResetToken(db, email);
      const resetUrl = `${env.AUTH_URL}/reset-password?token=${token}`;
      await sendPasswordResetEmail(env, { to: email, resetUrl });
    }
  } catch (err) {
    console.error("forgot-password: token/email delivery failed", err);
  }

  return NextResponse.json({ ok: true });
}
