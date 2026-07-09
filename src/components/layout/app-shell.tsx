import type { ReactNode } from "react";

import { NavSidebar } from "@/components/layout/nav-sidebar";
import {
  TripListPanel,
  type TripListItem,
} from "@/components/layout/trip-list-panel";

type AppShellProps = {
  userEmail?: string | null;
  trips: TripListItem[];
  children: ReactNode;
};

export function AppShell({ userEmail, trips, children }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)]">
      <NavSidebar userEmail={userEmail} />
      <TripListPanel trips={trips} />
      <main className="min-w-0 flex-1 overflow-y-auto bg-[var(--background)]">
        {children}
      </main>
    </div>
  );
}
