"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import {
  MoreIcon,
  SearchIcon,
} from "@/components/icons";
import {
  destinationImageUrl,
  formatBudget,
  formatDuration,
  formatRelativeTime,
} from "@/lib/format";
import { tripDeleteConfirmMessage } from "@/lib/trips/messages";

export type TripListItem = {
  id: string;
  destination: string;
  durationDays: number;
  budgetAmount: number;
  updatedAt: Date;
};

type TripCardProps = {
  trip: TripListItem;
  active: boolean;
};

function TripCard({ trip, active }: TripCardProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  async function handleDelete(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(false);
    setError(null);

    const confirmed = window.confirm(tripDeleteConfirmMessage(trip.destination));
    if (!confirmed) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/trips/${trip.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not delete trip");
        return;
      }
      if (active) {
        router.push("/trips");
      }
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Link
      href={`/trips/${trip.id}`}
      className={`group relative flex gap-3 rounded-2xl border bg-white p-3 no-underline transition-all ${
        active
          ? "border-[var(--primary)] shadow-[0_0_0_1px_rgba(255,122,61,0.3)]"
          : "border-[var(--border-muted)] hover:border-[var(--border)] hover:shadow-sm"
      } ${deleting ? "pointer-events-none opacity-50" : ""}`}
    >
      <div
        className="h-14 w-14 shrink-0 rounded-xl bg-cover bg-center ring-1 ring-black/5"
        style={{
          backgroundImage: `url('${destinationImageUrl(trip.destination, 140)}')`,
        }}
      />

      <div className="min-w-0 flex-1 pr-6">
        <strong className="block truncate text-sm font-bold text-[var(--foreground)]">
          {trip.destination}
        </strong>
        <span className="mt-1 block text-xs text-[var(--muted)]">
          {formatDuration(trip.durationDays)} · {formatBudget(trip.budgetAmount)}
        </span>
        <span
          className={`mt-1 block text-[11px] font-medium ${
            active ? "text-[var(--primary)]" : "text-[var(--muted-light)]"
          }`}
        >
          Updated {formatRelativeTime(trip.updatedAt)}
        </span>
        {error ? (
          <span className="mt-1 block text-[11px] font-medium text-red-600" role="alert">
            {error}
          </span>
        ) : null}
      </div>

      <div className="absolute right-2 top-2" ref={menuRef}>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted-light)] opacity-0 transition-opacity hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)] group-hover:opacity-100"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenuOpen((o) => !o);
          }}
          aria-label="Trip options"
        >
          <MoreIcon />
        </button>

        {menuOpen ? (
          <>
            <button
              type="button"
              className="fixed inset-0 z-10 cursor-default"
              aria-label="Close menu"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMenuOpen(false);
              }}
            />
            <div className="absolute right-0 top-full z-20 mt-1 min-w-[120px] overflow-hidden rounded-xl border border-[var(--border-muted)] bg-white py-1 shadow-lg">
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                onClick={handleDelete}
              >
                Delete
              </button>
            </div>
          </>
        ) : null}
      </div>
    </Link>
  );
}

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

  return (
    <section className="flex h-full min-h-0 w-[340px] shrink-0 flex-col border-r border-[var(--border-muted)] bg-[var(--background)]">
      <div className="shrink-0 px-4 pt-4">
        <label className="search-field">
          <SearchIcon className="search-field-icon" />
          <input
            type="search"
            placeholder="Search trips..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="search-field-input"
          />
        </label>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {filtered.length === 0 ? (
          <p className="px-2 py-10 text-center text-sm leading-relaxed text-[var(--muted)]">
            {trips.length === 0
              ? "No trips yet. Create one to get started."
              : "No trips match your search."}
          </p>
        ) : (
          <ul className="grid gap-3">
            {filtered.map((trip) => (
              <li key={trip.id}>
                <TripCard trip={trip} active={trip.id === activeId} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
