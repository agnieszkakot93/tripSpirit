import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { users } from "@/db/schema";
import { consumePasswordResetToken } from "@/lib/auth-tokens";
import { getDb } from "@/lib/db";
import { hashPassword } from "@/lib/password";

export async function POST(request: Request) {
  let body: { token?: unknown; password?: unknown };
  try {
    body = (await request.json()) as { token?: unknown; password?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { token, password } = body;
  if (typeof token !== "string" || !token) {
    return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
  }
  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }

  try {
    const db = await getDb();
    const email = await consumePasswordResetToken(db, token);
    if (!email) {
      return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);
    const updated = await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.email, email))
      .returning({ id: users.id });

    // Account was removed between token issue and consume — the token is now
    // spent, so surface the same generic failure rather than a false success.
    if (updated.length === 0) {
      return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
