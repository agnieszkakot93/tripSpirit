import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { users, verificationTokens } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { password?: unknown };
  try {
    body = (await request.json()) as { password?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const password = body.password;
  if (typeof password !== "string" || !password) {
    return NextResponse.json({ error: "Password is required" }, { status: 400 });
  }

  const db = await getDb();

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user?.passwordHash) {
    return NextResponse.json({ error: "Invalid password" }, { status: 403 });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid password" }, { status: 403 });
  }

  // verification_tokens has no FK to users (Auth.js adapter design), so clean
  // any orphaned reset tokens for this email explicitly.
  if (user.email) {
    await db
      .delete(verificationTokens)
      .where(eq(verificationTokens.identifier, user.email));
  }

  // users row cascades to trips / sessions / accounts.
  await db.delete(users).where(eq(users.id, user.id));

  return NextResponse.json({ ok: true });
}
