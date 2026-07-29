"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { TripsHeader } from "@/components/layout/trips-header";
import {
  TripListPanel,
  type TripListItem,
} from "@/components/layout/trip-list-panel";

type TripsMainAreaProps = {
  trips: TripListItem[];
  userName?: string | null;
  userEmail?: string | null;
  children: ReactNode;
};

export function TripsMainArea({
  trips,
  userName,
  userEmail,
  children,
}: TripsMainAreaProps) {
  const pathname = usePathname();
  const isTrips = pathname === "/trips" || pathname.startsWith("/trips/");

  if (!isTrips) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <main className="min-h-0 flex-1 overflow-y-auto bg-[var(--background)]">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--background)]">
      <TripsHeader userName={userName} userEmail={userEmail} />
      <div className="flex min-h-0 flex-1">
        <TripListPanel trips={trips} />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
