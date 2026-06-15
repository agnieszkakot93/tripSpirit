import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import type { AppDatabase } from "@/lib/db";

import {
  deleteTrip,
  getTripForUser,
  insertTrip,
  updateTrip,
} from "./queries";

// Create a fresh in-memory SQLite DB for each test with the project schema.
function makeDb(): { db: AppDatabase; sqlite: Database.Database } {
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
  `);
  const db = drizzle(sqlite, { schema }) as unknown as AppDatabase;
  return { db, sqlite };
}

// Seed a user row so the FK constraint on trips is satisfied.
function seedUser(db: AppDatabase, userId: string) {
  db.insert(schema.users).values({ id: userId }).run();
}

function seedTrip(
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

describe("getTripForUser", () => {
  let db: AppDatabase;
  beforeEach(() => { ({ db } = makeDb()); });

  it("returns the trip when owner matches", async () => {
    seedUser(db, "u1");
    const created = await seedTrip(db, "u1");
    const found = await getTripForUser(db, "u1", created.id);
    expect(found).not.toBeNull();
    expect(found?.destination).toBe("Lisbon");
  });

  it("returns null for a different user", async () => {
    seedUser(db, "u1");
    seedUser(db, "u2");
    const created = await seedTrip(db, "u1");
    const found = await getTripForUser(db, "u2", created.id);
    expect(found).toBeNull();
  });

  it("returns null for a non-existent id", async () => {
    seedUser(db, "u1");
    const found = await getTripForUser(db, "u1", "no-such-id");
    expect(found).toBeNull();
  });
});

describe("updateTrip", () => {
  let db: AppDatabase;
  let sqlite: Database.Database;
  beforeEach(() => { ({ db, sqlite } = makeDb()); });

  it("updates editable fields and returns the updated row", async () => {
    seedUser(db, "u1");
    const created = await seedTrip(db, "u1");
    const updated = await updateTrip(db, "u1", created.id, {
      destination: "Tokyo",
      durationDays: 10,
      budgetAmount: 3000,
    });
    expect(updated).not.toBeNull();
    expect(updated?.destination).toBe("Tokyo");
    expect(updated?.durationDays).toBe(10);
    expect(updated?.budgetAmount).toBe(3000);
  });

  it("returns null when the trip belongs to a different user", async () => {
    seedUser(db, "u1");
    seedUser(db, "u2");
    const created = await seedTrip(db, "u1");
    const result = await updateTrip(db, "u2", created.id, {
      destination: "Hacked",
      durationDays: 1,
      budgetAmount: 1,
    });
    expect(result).toBeNull();
  });

  it("does not clobber itinerary_json", async () => {
    seedUser(db, "u1");
    const created = await seedTrip(db, "u1");
    // Set itinerary_json directly via the raw SQLite client (test setup only).
    sqlite.exec(
      `UPDATE trips SET itinerary_json = '{"days":[]}' WHERE id = '${created.id}'`,
    );
    await updateTrip(db, "u1", created.id, {
      destination: "Vienna",
      durationDays: 3,
      budgetAmount: 500,
    });
    const row = await getTripForUser(db, "u1", created.id);
    expect(row?.itineraryJson).toBe('{"days":[]}');
    expect(row?.destination).toBe("Vienna");
  });

  it("returns null for a non-existent trip id", async () => {
    seedUser(db, "u1");
    const result = await updateTrip(db, "u1", "no-such-id", {
      destination: "Nowhere",
      durationDays: 1,
      budgetAmount: 1,
    });
    expect(result).toBeNull();
  });
});

describe("deleteTrip", () => {
  let db: AppDatabase;
  beforeEach(() => { ({ db } = makeDb()); });

  it("deletes the owner's trip and returns true", async () => {
    seedUser(db, "u1");
    const created = await seedTrip(db, "u1");
    const deleted = await deleteTrip(db, "u1", created.id);
    expect(deleted).toBe(true);
    expect(await getTripForUser(db, "u1", created.id)).toBeNull();
  });

  it("returns false and does not delete when user is wrong", async () => {
    seedUser(db, "u1");
    seedUser(db, "u2");
    const created = await seedTrip(db, "u1");
    const deleted = await deleteTrip(db, "u2", created.id);
    expect(deleted).toBe(false);
    expect(await getTripForUser(db, "u1", created.id)).not.toBeNull();
  });

  it("returns false for a non-existent trip id", async () => {
    seedUser(db, "u1");
    const deleted = await deleteTrip(db, "u1", "no-such-id");
    expect(deleted).toBe(false);
  });
});
