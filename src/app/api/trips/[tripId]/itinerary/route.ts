import { createOpenAI } from "@ai-sdk/openai";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { streamObject } from "ai";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { buildItineraryPrompt, itinerarySchema } from "@/lib/trips/itinerary";
import { getTripForUser, updateTripItinerary } from "@/lib/trips/queries";

// Abort below the 30s edge-runtime ceiling so the error surfaces cleanly
// before the runtime hard-kills the request (PRD 30s NFR; no buffer at the edge).
const GENERATION_TIMEOUT_MS = 28_000;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const { tripId } = await params;

  // Read the key + execution context from the Cloudflare env binding — never
  // process.env (it is not reliably populated on the workerd runtime).
  const { env, ctx } = await getCloudflareContext({ async: true });
  const db = getDb();

  const trip = await getTripForUser(db, userId, tripId);
  // notFound for missing AND wrong-owner — never leak another user's trip.
  if (!trip) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // One-shot generation: refuse to overwrite an existing itinerary (no regenerate).
  if (trip.itineraryJson) {
    return NextResponse.json(
      { error: "Itinerary already generated" },
      { status: 409 },
    );
  }

  const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });

  const result = streamObject({
    model: openai("gpt-4o-mini"),
    schema: itinerarySchema,
    prompt: buildItineraryPrompt({
      destination: trip.destination,
      durationDays: trip.durationDays,
      budgetAmount: trip.budgetAmount,
    }),
    abortSignal: AbortSignal.timeout(GENERATION_TIMEOUT_MS),
    onFinish: ({ object }) => {
      // Persist only a complete, schema-valid object (undefined on abort/error).
      // waitUntil keeps the worker alive until the D1 write commits, since this
      // fires after the response stream has begun flushing to the client.
      if (object) {
        ctx.waitUntil(updateTripItinerary(db, userId, tripId, object));
      }
    },
  });

  return result.toTextStreamResponse();
}
