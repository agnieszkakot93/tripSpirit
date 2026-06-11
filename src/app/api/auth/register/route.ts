import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { hashPassword } from "@/lib/password";

type RegisterBody = {
  email?: unknown;
  password?: unknown;
  name?: unknown;
};

export async function POST(request: Request) {
  let body: RegisterBody;
  try {
    body = (await request.json()) as RegisterBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const emailRaw = body.email;
  const passwordRaw = body.password;
  const nameRaw = body.name;

  if (typeof emailRaw !== "string" || typeof passwordRaw !== "string") {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 },
    );
  }

  const email = emailRaw.trim().toLowerCase();
  if (!email.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  if (passwordRaw.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }

  await getCloudflareContext({ async: true });
  const db = getDb();

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 },
    );
  }

  const id = crypto.randomUUID();
  const name =
    typeof nameRaw === "string" && nameRaw.trim() ? nameRaw.trim() : null;
  const passwordHash = await hashPassword(passwordRaw);

  await db.insert(users).values({
    id,
    email,
    name,
    emailVerified: null,
    image: null,
    passwordHash,
  });

  return NextResponse.json({ ok: true, userId: id }, { status: 201 });
}
