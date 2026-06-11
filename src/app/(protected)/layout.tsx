import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { auth } from "@/lib/auth";

// Auth gate for every route in this group. Replaces the former proxy.ts
// middleware guard — @opennextjs/cloudflare does not support Next.js 16's
// Node-runtime proxy, so protection lives in a Server Component layout.
// API routes are guarded separately inside their own handlers.
export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  if (!session) {
    redirect(`/login${await callbackQuery()}`);
  }
  return <>{children}</>;
}

// Derive `?callbackUrl=<original-path>` so sign-in returns the user to the
// route they requested. There is no official RSC pathname API; under the
// Cloudflare runtime OpenNext exposes the full request URL via
// `x-opennext-initial-url`, with `next-url` as a fallback for `next dev`.
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
