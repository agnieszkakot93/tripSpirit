import { notFound } from "next/navigation";

import { TripWorkspace } from "@/components/trip-workspace";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { itinerarySchema, type Itinerary } from "@/lib/trips/itinerary";
import { getTripForUser } from "@/lib/trips/queries";
import type { PartialItinerary } from "@/components/itinerary-view";

type ParsedItinerary =
  | { valid: true; data: Itinerary }
  | { valid: false; data: PartialItinerary }
  | null;

function parseItinerary(json: string | null): ParsedItinerary {
  if (!json) return null;
  try {
    const raw = JSON.parse(json);
    const result = itinerarySchema.safeParse(raw);
    if (result.success) {
      return { valid: true, data: result.data };
    }
    return { valid: false, data: raw as PartialItinerary };
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

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) notFound();

  const trip = await getTripForUser(await getDb(), userId, tripId);
  if (!trip) notFound();

  const savedItinerary = parseItinerary(trip.itineraryJson);

  return (
    <TripWorkspace
      tripId={trip.id}
      destination={trip.destination}
      durationDays={trip.durationDays}
      budgetAmount={trip.budgetAmount}
      savedItinerary={savedItinerary}
    />
  );
}
