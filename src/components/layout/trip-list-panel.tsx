"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import { SearchIcon } from "@/components/icons";
import {
  destinationImageUrl,
  formatBudget,
  formatDuration,
  formatRelativeTime,
} from "@/lib/format";

export type TripListItem = {
  id: string;
  destination: string;
  durationDays: number;
  budgetAmount: number;
  updatedAt: Date;
};

type TripListPanelProps = {
  trips: TripListItem[];
};

export function TripListPanel({ trips }: TripListPanelProps) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");

  const activeId = pathname.startsWith("/trips/")
    ? pathname.split("/")[2]
    : null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return trips;
    return trips.filter((t) =>
      t.destination.toLowerCase().includes(q),
    );
  }, [trips, query]);

  if (pathname === "/profile") return null;

  return (
    <section className="flex h-full w-[320px] shrink-0 flex-col border-r border-[var(--border-muted)] bg-white max-md:h-auto max-md:w-full max-md:border-r-0 max-md:border-b">
      <div className="border-b border-[var(--border-muted)] p-6">
        <h2 className="text-xl font-black tracking-tight text-[var(--foreground)]">
          My trips
        </h2>
        <div className="relative mt-4">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted-light)]" />
          <input
            type="search"
            placeholder="Search trips"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="field-input pl-11"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {filtered.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-[var(--muted)]">
            {trips.length === 0
              ? "No trips yet. Create your first city break."
              : "No trips match your search."}
          </p>
        ) : (
          <ul className="grid gap-3">
            {filtered.map((trip) => {
              const active = trip.id === activeId;
              return (
                <li key={trip.id}>
                  <Link
                    href={`/trips/${trip.id}`}
                    className={`group flex gap-3 rounded-[20px] border p-3 no-underline transition-colors ${
                      active
                        ? "border-[var(--primary)] bg-[rgba(255,122,61,0.08)]"
                        : "border-[var(--border-muted)] hover:border-[var(--border)] hover:bg-[var(--surface-muted)]"
                    }`}
                  >
                    <div
                      className="h-14 w-14 shrink-0 rounded-2xl bg-cover bg-center"
                      style={{
                        backgroundImage: `url('${destinationImageUrl(trip.destination, 120)}')`,
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <strong className="truncate text-sm font-bold text-[var(--foreground)]">
                          {trip.destination}
                        </strong>
                        {active ? (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--primary)]" />
                        ) : null}
                      </div>
                      <span className="mt-1 block text-xs text-[var(--muted)]">
                        {formatDuration(trip.durationDays)} ·{" "}
                        {formatBudget(trip.budgetAmount)}
                      </span>
                      <span className="mt-1 block text-xs text-[var(--muted-light)]">
                        Updated {formatRelativeTime(trip.updatedAt)}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
