import { createOpenAI } from "@ai-sdk/openai";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { streamObject } from "ai";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { buildItineraryPrompt, itinerarySchema } from "@/lib/trips/itinerary";
import { getTripForUser, updateItinerary, updateTripItinerary } from "@/lib/trips/queries";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const { tripId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = itinerarySchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Invalid itinerary" }, { status: 400 });
  }

  try {
    await getCloudflareContext({ async: true });
    const db = getDb();
    const updated = await updateItinerary(db, userId, tripId, result.data);
    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

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

  try {
    // Read the key + execution context from the Cloudflare env binding — never
    // process.env (it is not reliably populated on the workerd runtime).
    const { env, ctx } = await getCloudflareContext({ async: true });
    if (!env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
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
      onError: ({ error }) => {
        // Surface AI-boundary failures (quota, timeout/abort, upstream errors)
        // in worker logs — the stream otherwise closes silently to the client.
        console.error("itinerary generation failed", { tripId, error });
      },
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
  } catch {
    // Matches the sibling routes' error contract for pre-stream failures.
    // Errors during streaming surface to the client as an empty stream.
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
