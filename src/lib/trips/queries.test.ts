import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import type { AppDatabase } from "@/lib/db";

import {
  deleteTrip,
  getTripForUser,
  insertTrip,
  listTripsForUser,
  updateItinerary,
  updateTrip,
  updateTripItinerary,
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

describe("updateItinerary", () => {
  let db: AppDatabase;
  let sqlite: Database.Database;
  beforeEach(() => { ({ db, sqlite } = makeDb()); });

  const sampleItinerary = {
    days: [
      {
        day: 1,
        title: "Day one",
        activities: [
          { name: "Museum", description: "Art museum", approxCostEur: 15 },
        ],
      },
    ],
    totalApproxCostEur: 15,
  };

  it("updates itinerary_json for the owner and returns true", async () => {
    seedUser(db, "u1");
    const created = await seedTrip(db, "u1");
    sqlite.exec(
      `UPDATE trips SET itinerary_json = '{"days":[]}' WHERE id = '${created.id}'`,
    );
    const result = await updateItinerary(db, "u1", created.id, sampleItinerary);
    expect(result).toBe(true);
    const row = await getTripForUser(db, "u1", created.id);
    expect(JSON.parse(row!.itineraryJson!)).toEqual(sampleItinerary);
  });

  it("returns false and makes no mutation when user is wrong", async () => {
    seedUser(db, "u1");
    seedUser(db, "u2");
    const created = await seedTrip(db, "u1");
    sqlite.exec(
      `UPDATE trips SET itinerary_json = '{"days":[]}' WHERE id = '${created.id}'`,
    );
    const result = await updateItinerary(db, "u2", created.id, sampleItinerary);
    expect(result).toBe(false);
    const row = await getTripForUser(db, "u1", created.id);
    expect(row?.itineraryJson).toBe('{"days":[]}');
  });

  it("returns false for a non-existent trip id", async () => {
    seedUser(db, "u1");
    const result = await updateItinerary(db, "u1", "no-such-id", sampleItinerary);
    expect(result).toBe(false);
  });

  it("does not clobber other trip fields", async () => {
    seedUser(db, "u1");
    const created = await seedTrip(db, "u1");
    sqlite.exec(
      `UPDATE trips SET itinerary_json = '{"days":[]}' WHERE id = '${created.id}'`,
    );
    await updateItinerary(db, "u1", created.id, sampleItinerary);
    const row = await getTripForUser(db, "u1", created.id);
    expect(row?.destination).toBe("Lisbon");
    expect(row?.durationDays).toBe(5);
    expect(row?.budgetAmount).toBe(1000);
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

describe("listTripsForUser — FR-005 owner-scoped trip list", () => {
  let db: AppDatabase;
  let sqlite: Database.Database;
  beforeEach(() => { ({ db, sqlite } = makeDb()); });

  it("returns only the requesting user's trips", async () => {
    seedUser(db, "u1");
    seedUser(db, "u2");
    const u1Trip = await seedTrip(db, "u1", { destination: "Lisbon" });
    await seedTrip(db, "u2", { destination: "Berlin" });

    const list = await listTripsForUser(db, "u1");
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(u1Trip.id);
    expect(list[0]?.destination).toBe("Lisbon");
  });

  it("returns an empty array when the user has no trips", async () => {
    seedUser(db, "u1");
    expect(await listTripsForUser(db, "u1")).toEqual([]);
  });

  it("orders trips by createdAt descending (newest first)", async () => {
    seedUser(db, "u1");
    const older = await seedTrip(db, "u1", { destination: "Older" });
    const newer = await seedTrip(db, "u1", { destination: "Newer" });
    sqlite.exec(
      `UPDATE trips SET created_at = 1000 WHERE id = '${older.id}'`,
    );
    sqlite.exec(
      `UPDATE trips SET created_at = 2000 WHERE id = '${newer.id}'`,
    );

    const list = await listTripsForUser(db, "u1");
    expect(list.map((t) => t.id)).toEqual([newer.id, older.id]);
  });

  it("excludes itinerary_json from list projection (guardrail: no bulk leak)", async () => {
    seedUser(db, "u1");
    const trip = await seedTrip(db, "u1");
    sqlite.exec(
      `UPDATE trips SET itinerary_json = '{"days":[{"day":1,"title":"t","activities":[]}],"totalApproxCostEur":0}' WHERE id = '${trip.id}'`,
    );

    const list = await listTripsForUser(db, "u1");
    expect(list).toHaveLength(1);
    expect(list[0]).not.toHaveProperty("itineraryJson");
    expect(list[0]).not.toHaveProperty("itinerary_json");
  });
});

const sampleItineraryForGeneration = {
  days: [
    {
      day: 1,
      title: "Day one",
      activities: [
        { name: "Museum", description: "Art museum", approxCostEur: 15 },
      ],
    },
  ],
  totalApproxCostEur: 15,
};

describe("updateTripItinerary — FR-009 one-shot generation guard", () => {
  let db: AppDatabase;
  let sqlite: Database.Database;
  beforeEach(() => { ({ db, sqlite } = makeDb()); });

  it("persists when itinerary_json is null and returns true", async () => {
    seedUser(db, "u1");
    const trip = await seedTrip(db, "u1");
    const result = await updateTripItinerary(
      db,
      "u1",
      trip.id,
      sampleItineraryForGeneration,
    );
    expect(result).toBe(true);
    const row = await getTripForUser(db, "u1", trip.id);
    expect(JSON.parse(row!.itineraryJson!)).toEqual(sampleItineraryForGeneration);
  });

  it("returns false and leaves existing itinerary unchanged (no regeneration)", async () => {
    seedUser(db, "u1");
    const trip = await seedTrip(db, "u1");
    const first = { ...sampleItineraryForGeneration, totalApproxCostEur: 15 };
    const second = { ...sampleItineraryForGeneration, totalApproxCostEur: 99 };
    await updateTripItinerary(db, "u1", trip.id, first);

    const result = await updateTripItinerary(db, "u1", trip.id, second);
    expect(result).toBe(false);

    const row = await getTripForUser(db, "u1", trip.id);
    expect(JSON.parse(row!.itineraryJson!)).toEqual(first);
  });

  it("returns false for wrong owner without mutating the row", async () => {
    seedUser(db, "u1");
    seedUser(db, "u2");
    const trip = await seedTrip(db, "u1");

    const result = await updateTripItinerary(
      db,
      "u2",
      trip.id,
      sampleItineraryForGeneration,
    );
    expect(result).toBe(false);
    expect((await getTripForUser(db, "u1", trip.id))?.itineraryJson).toBeNull();
  });

  it("returns false for a non-existent trip id", async () => {
    seedUser(db, "u1");
    const result = await updateTripItinerary(
      db,
      "u1",
      "no-such-id",
      sampleItineraryForGeneration,
    );
    expect(result).toBe(false);
  });
});
