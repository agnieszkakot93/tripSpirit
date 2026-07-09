"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "next-auth/react";

import {
  MapPinIcon,
  PlusIcon,
  SettingsIcon,
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
      <aside className="flex h-screen w-[248px] shrink-0 flex-col justify-between overflow-y-auto bg-[var(--sidebar)] p-5 text-white">
        <div>
          <Link href="/trips" className="flex items-center gap-2.5 no-underline">
            <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)]">
              <MapPinIcon className="h-5 w-5" />
            </span>
            <span className="text-[17px] font-black tracking-tight text-white">
              TripSprint AI
            </span>
          </Link>

          <button
            type="button"
            className="btn-primary mt-7 flex w-full items-center justify-center gap-2 py-3.5"
            onClick={() => setCreateOpen(true)}
          >
            <PlusIcon />
            Create trip
          </button>

          <nav className="mt-5 grid gap-0.5">
            <Link
              href="/trips"
              className={`flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-semibold no-underline transition-colors ${
                isTrips
                  ? "bg-white/12 text-white"
                  : "text-white/65 hover:bg-white/6 hover:text-white"
              }`}
            >
              <SuitcaseIcon />
              My trips
            </Link>
            <Link
              href="/profile"
              className={`flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-semibold no-underline transition-colors ${
                isProfile
                  ? "bg-white/12 text-white"
                  : "text-white/65 hover:bg-white/6 hover:text-white"
              }`}
            >
              <UserIcon />
              Profile
            </Link>
            <Link
              href="/profile"
              className="flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-semibold text-white/65 no-underline transition-colors hover:bg-white/6 hover:text-white"
            >
              <SettingsIcon />
              Settings
            </Link>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-semibold text-white/65 transition-colors hover:bg-white/6 hover:text-white"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <SignOutIcon />
              Sign out
            </button>
          </nav>
        </div>

        <div>
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
            <div
              className="h-24 bg-cover bg-center"
              style={{
                backgroundImage:
                  "linear-gradient(180deg, transparent 20%, rgba(23,18,15,0.85)), url('https://picsum.photos/seed/coastal-town/400/200')",
              }}
            />
            <div className="p-4">
              <p className="text-sm leading-relaxed text-white/85">
                AI-assisted city-break planner. Plan smarter. Travel better.
              </p>
            </div>
          </div>
          {userEmail ? (
            <p className="mt-4 truncate px-1 text-xs text-white/40">{userEmail}</p>
          ) : null}
        </div>
      </aside>

      <TripCreateModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
