import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { users } from "@/db/schema";
import { getDb } from "@/lib/db";

export async function DELETE(request: Request) {
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

  const db = await getDb();

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "No account found for that email" }, { status: 404 });
  }

  await db.delete(users).where(eq(users.email, email));

  return NextResponse.json({ ok: true });
}
