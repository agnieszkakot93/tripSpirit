import { getCloudflareContext } from "@opennextjs/cloudflare";

import { SiteHeader } from "@/components/site-header";
import { TripCard } from "@/components/trip-card";
import { TripCreateForm } from "@/components/trip-create-form";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listTripsForUser } from "@/lib/trips/queries";

export default async function TripsPage() {
  // The (protected) layout guarantees a session; guard again for type safety.
  const session = await auth();
  const userId = session?.user?.id;

  await getCloudflareContext({ async: true });
  const trips = userId ? await listTripsForUser(getDb(), userId) : [];

  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col gap-6 px-6 py-16">
      <SiteHeader />
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Your trips
        </h1>
      </div>

      <TripCreateForm />

      {trips.length === 0 ? (
        <p className="text-zinc-600 dark:text-zinc-400">
          You have no trips yet. Plan your first one above.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {trips.map((trip) => (
            <li key={trip.id}>
              <TripCard
                id={trip.id}
                destination={trip.destination}
                durationDays={trip.durationDays}
                budgetAmount={trip.budgetAmount}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
