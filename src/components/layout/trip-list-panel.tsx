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
    <section className="flex h-screen w-[300px] shrink-0 flex-col border-r border-[var(--border-muted)] bg-white shadow-[4px_0_24px_rgba(49,33,20,0.04)]">
      <div className="shrink-0 border-b border-[var(--border-muted)] px-5 py-5">
        <h2 className="text-lg font-black tracking-tight text-[var(--foreground)]">
          My trips
        </h2>
        <div className="relative mt-3">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-light)]" />
          <input
            type="search"
            placeholder="Search trips"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="field-input py-2.5 pl-10 text-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {filtered.length === 0 ? (
          <p className="px-2 py-10 text-center text-sm leading-relaxed text-[var(--muted)]">
            {trips.length === 0
              ? "No trips yet. Use Create trip in the sidebar."
              : "No trips match your search."}
          </p>
        ) : (
          <ul className="grid gap-2">
            {filtered.map((trip) => {
              const active = trip.id === activeId;
              return (
                <li key={trip.id}>
                  <Link
                    href={`/trips/${trip.id}`}
                    className={`flex gap-3 rounded-2xl border p-2.5 no-underline transition-all ${
                      active
                        ? "border-[var(--primary)] bg-[rgba(255,122,61,0.1)] shadow-[0_0_0_1px_rgba(255,122,61,0.25)]"
                        : "border-transparent hover:border-[var(--border-muted)] hover:bg-[var(--surface-muted)]"
                    }`}
                  >
                    <div
                      className="h-12 w-12 shrink-0 rounded-xl bg-cover bg-center ring-1 ring-black/5"
                      style={{
                        backgroundImage: `url('${destinationImageUrl(trip.destination, 120)}')`,
                      }}
                    />
                    <div className="min-w-0 flex-1 py-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <strong className="truncate text-sm font-bold text-[var(--foreground)]">
                          {trip.destination}
                        </strong>
                        {active ? (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--primary)]" />
                        ) : null}
                      </div>
                      <span className="mt-0.5 block text-xs text-[var(--muted)]">
                        {formatDuration(trip.durationDays)} ·{" "}
                        {formatBudget(trip.budgetAmount)}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-[var(--muted-light)]">
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

      {trips.length > 0 ? (
        <div className="shrink-0 border-t border-[var(--border-muted)] px-5 py-3">
          <p className="text-center text-[11px] font-medium text-[var(--muted-light)]">
            {trips.length} {trips.length === 1 ? "trip" : "trips"}
          </p>
        </div>
      ) : null}
    </section>
  );
}
