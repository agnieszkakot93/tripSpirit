import type { ReactNode } from "react";

import { NavSidebar } from "@/components/layout/nav-sidebar";
import { TripsMainArea } from "@/components/layout/trips-main-area";
import type { TripListItem } from "@/components/layout/trip-list-panel";

type AppShellProps = {
  userName?: string | null;
  userEmail?: string | null;
  trips: TripListItem[];
  children: ReactNode;
};

export function AppShell({
  userName,
  userEmail,
  trips,
  children,
}: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)]">
      <NavSidebar userEmail={userEmail} />
      <TripsMainArea
        trips={trips}
        userName={userName}
        userEmail={userEmail}
      >
        {children}
      </TripsMainArea>
    </div>
  );
}
