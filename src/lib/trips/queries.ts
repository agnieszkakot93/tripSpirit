import { desc, eq, and, isNull } from "drizzle-orm";

import { trips } from "@/db/schema";
import type { AppDatabase } from "@/lib/db";
import type { Itinerary } from "@/lib/trips/itinerary";

export type TripRow = typeof trips.$inferSelect;

// Safety cap until list pagination is introduced (Phase 1 has no pagination spec).
const TRIP_LIST_LIMIT = 100;

// Exclude itinerary_json from the list query — the cards never render it and
// it will hold large JSON blobs once S-03 populates itineraries.
export function listTripsForUser(db: AppDatabase, userId: string) {
  return db
    .select({
      id: trips.id,
      userId: trips.userId,
      destination: trips.destination,
      durationDays: trips.durationDays,
      budgetAmount: trips.budgetAmount,
      createdAt: trips.createdAt,
      updatedAt: trips.updatedAt,
    })
    .from(trips)
    .where(eq(trips.userId, userId))
    .orderBy(desc(trips.createdAt))
    .limit(TRIP_LIST_LIMIT);
}

export function getTripForUser(
  db: AppDatabase,
  userId: string,
  tripId: string,
) {
  return db
    .select()
    .from(trips)
    .where(and(eq(trips.id, tripId), eq(trips.userId, userId)))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

export function insertTrip(
  db: AppDatabase,
  userId: string,
  values: { destination: string; durationDays: number; budgetAmount: number },
) {
  const id = crypto.randomUUID();
  const now = Date.now();
  return db
    .insert(trips)
    .values({
      id,
      userId,
      destination: values.destination,
      durationDays: values.durationDays,
      budgetAmount: values.budgetAmount,
      itineraryJson: null,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    })
    .returning()
    .then((rows) => rows[0]);
}

export async function updateTrip(
  db: AppDatabase,
  userId: string,
  tripId: string,
  values: { destination: string; durationDays: number; budgetAmount: number },
): Promise<TripRow | null> {
  const rows = await db
    .update(trips)
    .set({
      destination: values.destination,
      durationDays: values.durationDays,
      budgetAmount: values.budgetAmount,
      updatedAt: new Date(),
    })
    .where(and(eq(trips.id, tripId), eq(trips.userId, userId)))
    .returning();
  return rows[0] ?? null;
}

export async function deleteTrip(
  db: AppDatabase,
  userId: string,
  tripId: string,
): Promise<boolean> {
  const rows = await db
    .delete(trips)
    .where(and(eq(trips.id, tripId), eq(trips.userId, userId)))
    .returning({ id: trips.id });
  return rows.length > 0;
}

/**
 * Persist a generated itinerary, scoped to the owner and idempotent: the write
 * only lands when `itinerary_json IS NULL`, so a one-shot generation can never
 * overwrite an existing itinerary (S-03 has no regenerate). Returns true if a
 * row was actually written, false on no-op (already generated / not owner).
 */
export async function updateTripItinerary(
  db: AppDatabase,
  userId: string,
  tripId: string,
  itinerary: Itinerary,
): Promise<boolean> {
  const rows = await db
    .update(trips)
    .set({
      itineraryJson: JSON.stringify(itinerary),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(trips.id, tripId),
        eq(trips.userId, userId),
        isNull(trips.itineraryJson),
      ),
    )
    .returning({ id: trips.id });
  return rows.length > 0;
}
