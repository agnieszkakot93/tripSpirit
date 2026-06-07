import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

export const proxy = auth((req) => {
  const path = req.nextUrl.pathname;
  const isTripsArea = path === "/trips" || path.startsWith("/trips/");
  if (!req.auth && isTripsArea) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
});

export const config = {
  matcher: ["/trips", "/trips/:path*"],
};
