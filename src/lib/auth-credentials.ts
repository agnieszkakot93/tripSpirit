import { eq } from "drizzle-orm";

import { users } from "@/db/schema";
import type { AppDatabase } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

export type AuthorizeCredentialsInput = {
  email?: unknown;
  password?: unknown;
};

/** Shape returned to NextAuth Credentials `authorize` on success. */
export type AuthorizedUser = {
  id: string;
  email?: string;
  name?: string;
  image?: string;
};

/**
 * Validate email+password credentials against the users table (FR-002).
 * Returns a NextAuth-compatible user object on success, or `null` on any
 * failure — same contract as Credentials `authorize`.
 */
export async function authorizeCredentials(
  db: AppDatabase,
  credentials: AuthorizeCredentialsInput | undefined,
): Promise<AuthorizedUser | null> {
  const rawEmail = credentials?.email;
  const rawPassword = credentials?.password;
  if (
    typeof rawEmail !== "string" ||
    typeof rawPassword !== "string" ||
    !rawEmail.trim() ||
    !rawPassword
  ) {
    return null;
  }

  const email = rawEmail.trim().toLowerCase();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user?.passwordHash) return null;

  const ok = await verifyPassword(rawPassword, user.passwordHash);
  if (!ok) return null;

  return {
    id: user.id,
    email: user.email ?? undefined,
    name: user.name ?? undefined,
    image: user.image ?? undefined,
  };
}
