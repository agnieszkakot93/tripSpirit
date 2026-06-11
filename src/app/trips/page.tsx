import { SiteHeader } from "@/components/site-header";

export default function TripsPage() {
  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col gap-6 px-6 py-16">
      <SiteHeader />
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Your trips
        </h1>
      </div>
      <p className="text-zinc-600 dark:text-zinc-400">
        Saved itineraries will appear here once the trip planner UI is wired up
        (FR-004–FR-012).
      </p>
    </main>
  );
}
