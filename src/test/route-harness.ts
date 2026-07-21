import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "@/db/schema";
import type { AppDatabase } from "@/lib/db";
import { insertTrip } from "@/lib/trips/queries";

/**
 * Minimal session shape matching what trip routes check (`session?.user?.id`).
 * - `null` → unauthenticated (401)
 * - `{ user: { id } }` → authenticated
 * - `{ user: {} }` / `{}` → session without id (API still 401)
 */
export type MockSession =
  | null
  | {
      user?: {
        id?: string;
      };
    };

/** Mutable seams for `vi.mock("@/lib/auth")` / `vi.mock("@/lib/db")`. */
export const routeTestState: {
  session: MockSession;
  db: AppDatabase | null;
} = {
  session: null,
  db: null,
};

/** Drop-in for `vi.mock("@/lib/auth", () => ({ auth: mockAuth }))`. */
export async function mockAuth(): Promise<MockSession> {
  return routeTestState.session;
}

/** Drop-in for `vi.mock("@/lib/db", () => ({ getDb: mockGetDb }))`. */
export async function mockGetDb(): Promise<AppDatabase> {
  if (!routeTestState.db) {
    throw new Error(
      "routeTestState.db is null — call setupRouteTest() in beforeEach first",
    );
  }
  return routeTestState.db;
}

/** Fresh in-memory SQLite + drizzle with users/trips/verification_tokens DDL. */
export function makeTestDb(): {
  db: AppDatabase;
  sqlite: Database.Database;
} {
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT,
      email TEXT,
      emailVerified INTEGER,
      image TEXT,
      password_hash TEXT
    );
    CREATE TABLE trips (
      id TEXT PRIMARY KEY NOT NULL,
      userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      destination TEXT NOT NULL,
      duration_days INTEGER NOT NULL,
      budget_amount INTEGER NOT NULL,
      itinerary_json TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX trips_user_idx ON trips (userId);
    CREATE TABLE verification_tokens (
      identifier TEXT NOT NULL,
      token TEXT PRIMARY KEY NOT NULL,
      expires INTEGER NOT NULL
    );
  `);
  const db = drizzle(sqlite, { schema }) as unknown as AppDatabase;
  return { db, sqlite };
}

export function seedUser(
  db: AppDatabase,
  userId: string,
  overrides: Partial<{
    email: string;
    passwordHash: string;
  }> = {},
) {
  db.insert(schema.users)
    .values({
      id: userId,
      email: overrides.email,
      passwordHash: overrides.passwordHash,
    })
    .run();
}

/**
 * Insert a password-reset token row. Returns the raw token for reset-password
 * requests. Default expiry is 1 hour from now; pass a past Date for expired.
 */
export function seedResetToken(
  db: AppDatabase,
  email: string,
  overrides: Partial<{
    token: string;
    expires: Date;
  }> = {},
): string {
  const token = overrides.token ?? crypto.randomUUID();
  const expires =
    overrides.expires ?? new Date(Date.now() + 60 * 60 * 1000);

  db.insert(schema.verificationTokens)
    .values({ identifier: email, token, expires })
    .run();

  return token;
}

export function seedTrip(
  db: AppDatabase,
  userId: string,
  overrides: Partial<{
    destination: string;
    durationDays: number;
    budgetAmount: number;
  }> = {},
) {
  return insertTrip(db, userId, {
    destination: overrides.destination ?? "Lisbon",
    durationDays: overrides.durationDays ?? 5,
    budgetAmount: overrides.budgetAmount ?? 1000,
  });
}

/**
 * Wire the current test's DB into mockGetDb and reset session to null.
 *
 * Typical beforeEach (after top-level vi.mock of auth + db):
 * ```
 * const { db, sqlite, setSession } = setupRouteTest();
 * ```
 */
export function setupRouteTest() {
  const { db, sqlite } = makeTestDb();
  routeTestState.db = db;
  routeTestState.session = null;

  return {
    db,
    sqlite,
    setSession(session: MockSession) {
      routeTestState.session = session;
    },
  };
}
