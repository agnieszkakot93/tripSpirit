import { getCloudflareContext } from "@opennextjs/cloudflare";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ItineraryGenerator } from "@/components/itinerary-generator";
import { ItineraryView, type PartialItinerary } from "@/components/itinerary-view";
import { SiteHeader } from "@/components/site-header";
import { formatBudget, formatDuration } from "@/components/trip-card";
import { TripActions } from "@/components/trip-actions";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { itinerarySchema } from "@/lib/trips/itinerary";
import { getTripForUser } from "@/lib/trips/queries";

function parseItinerary(json: string | null): PartialItinerary | null {
  if (!json) return null;
  try {
    const raw = JSON.parse(json);
    // Prefer the schema-validated shape; fall back to best-effort partial
    // render for older/odd stored values (the view tolerates partial data).
    const result = itinerarySchema.safeParse(raw);
    return result.success ? result.data : (raw as PartialItinerary);
  } catch {
    return null;
  }
}

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;

  // The (protected) layout guarantees a session; guard again for type safety.
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) notFound();

  await getCloudflareContext({ async: true });
  const trip = await getTripForUser(getDb(), userId, tripId);

  // notFound() for both missing and wrong-owner so we never leak the
  // existence of another user's trip via a distinct error.
  if (!trip) notFound();

  const savedItinerary = parseItinerary(trip.itineraryJson);

  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col gap-6 px-6 py-16">
      <SiteHeader />

      <Link
        href="/trips"
        className="text-sm font-medium text-zinc-500 underline dark:text-zinc-400"
      >
        ← Back to trips
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          {trip.destination}
        </h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          {formatDuration(trip.durationDays)} · {formatBudget(trip.budgetAmount)}
        </p>
      </div>

      <TripActions
        id={trip.id}
        destination={trip.destination}
        durationDays={trip.durationDays}
        budgetAmount={trip.budgetAmount}
      />

      {savedItinerary ? (
        // One-shot: a saved itinerary renders read-only — no Generate button
        // (no regenerate, per PRD Non-Goals).
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
            Itinerary
          </h2>
          {savedItinerary ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              This itinerary reflects the trip details at the time it was
              generated. Editing the trip does not regenerate it.
            </p>
          ) : null}
          <ItineraryView itinerary={savedItinerary} />
        </section>
      ) : (
        <ItineraryGenerator tripId={trip.id} />
      )}
    </main>
  );
}
