import Link from "next/link";

import { MapPinIcon } from "@/components/icons";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--sidebar)] p-8">
      <div
        className="pointer-events-none fixed inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(circle at top left, #ffd2ac, transparent 32%), radial-gradient(circle at bottom right, #f7b267, transparent 28%)",
        }}
      />

      <main className="relative flex max-w-xl flex-col gap-8 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-[var(--foreground)] px-4 py-2 text-sm font-extrabold text-white">
          <MapPinIcon className="text-[var(--primary)]" />
          TripSprint AI
        </div>

        <div>
          <h1 className="text-5xl font-black leading-[0.95] tracking-tight text-white">
            Plan smarter city breaks.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-lg leading-relaxed text-white/75">
            Create a trip, generate a day-by-day itinerary, then customize every
            day, activity, and cost.
          </p>
        </div>

        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/login" className="btn-primary px-8 text-center no-underline">
            Sign in
          </Link>
          <Link
            href="/login?mode=register"
            className="rounded-full border border-white/30 px-8 py-3 text-center text-sm font-bold text-white no-underline transition-colors hover:bg-white/10"
          >
            Sign up
          </Link>
        </div>
      </main>
    </div>
  );
}
