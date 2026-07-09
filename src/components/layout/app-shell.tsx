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
    <div className="flex min-h-screen max-md:flex-col">
      <NavSidebar userEmail={userEmail} />
      <TripListPanel trips={trips} />
      <main className="min-h-0 min-w-0 flex-1 overflow-auto bg-[var(--background)] max-md:min-h-[60vh]">
        {children}
      </main>
    </div>
  );
}
