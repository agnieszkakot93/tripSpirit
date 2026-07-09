"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "next-auth/react";

import {
  MapPinIcon,
  PlusIcon,
  SignOutIcon,
  SuitcaseIcon,
  UserIcon,
} from "@/components/icons";
import { TripCreateModal } from "@/components/trip-create-modal";

type NavSidebarProps = {
  userEmail?: string | null;
};

export function NavSidebar({ userEmail }: NavSidebarProps) {
  const pathname = usePathname();
  const [createOpen, setCreateOpen] = useState(false);

  const isTrips =
    pathname === "/trips" || pathname.startsWith("/trips/");
  const isProfile = pathname === "/profile";

  return (
    <>
      <aside className="flex h-full w-[240px] shrink-0 flex-col justify-between bg-[var(--sidebar)] p-6 text-white max-md:h-auto max-md:w-full max-md:rounded-b-[28px]">
        <div>
          <Link href="/trips" className="flex items-center gap-2.5 no-underline">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)]">
              <MapPinIcon />
            </span>
            <span className="text-lg font-black tracking-tight text-white">
              TripSprint AI
            </span>
          </Link>

          <button
            type="button"
            className="btn-primary mt-8 flex w-full items-center justify-center gap-2"
            onClick={() => setCreateOpen(true)}
          >
            <PlusIcon />
            Create trip
          </button>

          <nav className="mt-6 grid gap-1">
            <Link
              href="/trips"
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold no-underline transition-colors ${
                isTrips
                  ? "bg-white/10 text-white"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              <SuitcaseIcon />
              My trips
            </Link>
            <Link
              href="/profile"
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold no-underline transition-colors ${
                isProfile
                  ? "bg-white/10 text-white"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              <UserIcon />
              Profile
            </Link>
          </nav>
        </div>

        <div>
          <button
            type="button"
            className="mb-6 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-white/70 transition-colors hover:bg-white/5 hover:text-white"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <SignOutIcon />
            Sign out
          </button>

          <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-4">
            <div
              className="mb-3 h-20 rounded-2xl bg-cover bg-center"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, rgba(255,122,61,0.4), rgba(23,18,15,0.8)), url('https://picsum.photos/seed/tripsprint/400/200')",
              }}
            />
            <p className="text-sm leading-relaxed text-white/80">
              AI-assisted city-break planner. Plan smarter. Travel better.
            </p>
            {userEmail ? (
              <p className="mt-2 truncate text-xs text-white/50">{userEmail}</p>
            ) : null}
          </div>
        </div>
      </aside>

      <TripCreateModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
