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

  const db = await getDb();
  const email = await consumePasswordResetToken(db, token);
  if (!email) {
    return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);
  await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.email, email));

  return NextResponse.json({ ok: true });
}
