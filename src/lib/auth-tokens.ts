import { and, eq, gt } from "drizzle-orm";

import { verificationTokens } from "@/db/schema";
import type { AppDatabase } from "@/lib/db";

/** Password-reset tokens live in the Auth.js `verification_tokens` table. */
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Create a single-use password-reset token for `email`, replacing any prior
 * tokens for the same identifier. Returns the raw token to embed in the link.
 */
export async function createPasswordResetToken(
  db: AppDatabase,
  email: string,
): Promise<string> {
  const token = crypto.randomUUID();
  const expires = new Date(Date.now() + TOKEN_TTL_MS);

  await db
    .delete(verificationTokens)
    .where(eq(verificationTokens.identifier, email));

  await db.insert(verificationTokens).values({ identifier: email, token, expires });

  return token;
}

/**
 * Validate and consume a reset token. Returns the associated email on success
 * (deleting the token so it cannot be reused), or null if missing/expired.
 */
export async function consumePasswordResetToken(
  db: AppDatabase,
  token: string,
): Promise<string | null> {
  const [row] = await db
    .select({ identifier: verificationTokens.identifier })
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.token, token),
        gt(verificationTokens.expires, new Date()),
      ),
    )
    .limit(1);

  if (!row) return null;

  await db
    .delete(verificationTokens)
    .where(eq(verificationTokens.token, token));

  return row.identifier;
}
