import { desc, eq, and } from "drizzle-orm";

import { trips } from "@/db/schema";
import type { AppDatabase } from "@/lib/db";

export type TripRow = typeof trips.$inferSelect;

// Safety cap until list pagination is introduced (Phase 1 has no pagination spec).
const TRIP_LIST_LIMIT = 100;

export function listTripsForUser(db: AppDatabase, userId: string) {
  return db
    .select()
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
