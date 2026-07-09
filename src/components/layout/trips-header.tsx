"use client";

import { BellIcon } from "@/components/icons";

type TripsHeaderProps = {
  userName?: string | null;
  userEmail?: string | null;
};

function displayName(name?: string | null, email?: string | null): string {
  if (name?.trim()) return name.trim().split(" ")[0] ?? name;
  if (email) return email.split("@")[0] ?? "Traveler";
  return "Traveler";
}

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

export function TripsHeader({ userName, userEmail }: TripsHeaderProps) {
  const name = displayName(userName, userEmail);

  return (
    <header className="flex shrink-0 items-center justify-between border-b border-[var(--border-muted)] bg-white px-8 py-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-[var(--foreground)]">
          My trips
        </h1>
        <p className="mt-0.5 text-sm text-[var(--muted)]">
          Your upcoming and saved city breaks.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-muted)] bg-[var(--surface-muted)] text-[var(--muted)] transition-colors hover:border-[var(--border)] hover:text-[var(--foreground)]"
          aria-label="Notifications"
        >
          <BellIcon />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[var(--primary)] ring-2 ring-white" />
        </button>

        <div className="flex items-center gap-2.5 rounded-2xl border border-[var(--border-muted)] bg-white py-1.5 pl-1.5 pr-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff9a5c] to-[#ff7a3d] text-xs font-black text-white">
            {initials(name)}
          </span>
          <span className="text-sm font-bold text-[var(--foreground)]">
            {name}
          </span>
        </div>
      </div>
    </header>
  );
}
