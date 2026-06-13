import { getCloudflareContext } from "@opennextjs/cloudflare";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { formatBudget, formatDuration } from "@/components/trip-card";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getTripForUser } from "@/lib/trips/queries";

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

      <section className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
          Itinerary
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          No itinerary yet. AI itinerary generation arrives in a later update —
          your trip details are saved and ready.
        </p>
      </section>
    </main>
  );
}
