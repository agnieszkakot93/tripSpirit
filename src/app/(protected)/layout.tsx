import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listTripsForUser } from "@/lib/trips/queries";

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  if (!session) {
    redirect(`/login${await callbackQuery()}`);
  }

  const userId = session.user?.id;
  const trips = userId
    ? (await listTripsForUser(await getDb(), userId)).map((t) => ({
        id: t.id,
        destination: t.destination,
        durationDays: t.durationDays,
        budgetAmount: t.budgetAmount,
        updatedAt: t.updatedAt,
      }))
    : [];

  return (
    <AppShell userEmail={session.user?.email} trips={trips}>
      {children}
    </AppShell>
  );
}

async function callbackQuery(): Promise<string> {
  const requestHeaders = await headers();
  let path: string | null = null;

  const initialUrl = requestHeaders.get("x-opennext-initial-url");
  if (initialUrl) {
    try {
      const url = new URL(initialUrl);
      path = url.pathname + url.search;
    } catch {
      path = null;
    }
  }
  if (!path) {
    const nextUrl = requestHeaders.get("next-url");
    if (nextUrl?.startsWith("/")) path = nextUrl;
  }

  return path ? `?callbackUrl=${encodeURIComponent(path)}` : "";
}
