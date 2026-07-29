import { createOpenAI } from "@ai-sdk/openai";
import { streamObject } from "ai";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getAppCloudflareContext } from "@/lib/cloudflare-context";
import { getDb } from "@/lib/db";
import {
  buildItineraryPrompt,
  buildItinerarySchemaForDuration,
  isItineraryCompleteForDuration,
  itinerarySchema,
  type Itinerary,
} from "@/lib/trips/itinerary";
import { getTripForUser, updateItinerary, updateTripItinerary } from "@/lib/trips/queries";

/** Deterministic itinerary for e2e — same shape as Vitest `sampleItinerary`. */
function sampleItinerary(dayCount: number): Itinerary {
  return {
    days: Array.from({ length: dayCount }, (_, i) => ({
      day: i + 1,
      title: `Day ${i + 1}`,
      activities: [
        {
          name: "Activity",
          description: "Description",
          approxCostEur: 10,
        },
      ],
    })),
    totalApproxCostEur: dayCount * 10,
  };
}

function fixtureTextStreamResponse(itinerary: Itinerary): Response {
  // Matches streamObject().toTextStreamResponse(): plain JSON text chunks that
  // accumulate into a complete object for useObject.
  return new Response(JSON.stringify(itinerary), {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

type WaitUntilContext = {
  waitUntil: (promise: Promise<unknown>) => void;
};

/**
 * Schedule a post-stream D1 write via waitUntil. The HTTP response may already
 * be 200 when this runs — log persist failures so production monitoring / tail
 * can surface silent data loss (Risk #6).
 */
function scheduleItineraryPersist(
  ctx: WaitUntilContext,
  tripId: string,
  persist: Promise<boolean>,
) {
  ctx.waitUntil(
    persist
      .then((written) => {
        if (!written) {
          console.error("itinerary/generate: persist_failed", {
            tripId,
            reason: "no_row_updated",
          });
        }
      })
      .catch((error: unknown) => {
        console.error("itinerary/generate: persist_failed", { tripId, error });
      }),
  );
}

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
    const db = await getDb();
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
    const { env, ctx } = await getAppCloudflareContext();
    const db = await getDb();

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

    // Dev/CI-only: skip OpenAI and return a canned stream while still running
    // the normal persist path (onFinish equivalent). Never set on production.
    if (env.E2E_ITINERARY_FIXTURE === "true") {
      const fixture = sampleItinerary(trip.durationDays);
      if (!isItineraryCompleteForDuration(fixture, trip.durationDays)) {
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
      }
      scheduleItineraryPersist(
        ctx,
        tripId,
        updateTripItinerary(db, userId, tripId, fixture),
      );
      return fixtureTextStreamResponse(fixture);
    }

    if (!env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }

    const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });

    const generationSchema = buildItinerarySchemaForDuration(trip.durationDays);

    const result = streamObject({
      model: openai("gpt-4o-mini"),
      schema: generationSchema,
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
        // Persist only a complete object with one day per trip duration.
        // waitUntil keeps the worker alive until the D1 write commits, since this
        // fires after the response stream has begun flushing to the client.
        if (
          object &&
          isItineraryCompleteForDuration(object, trip.durationDays)
        ) {
          scheduleItineraryPersist(
            ctx,
            tripId,
            updateTripItinerary(db, userId, tripId, object),
          );
        } else if (object) {
          console.error("itinerary generation incomplete", {
            tripId,
            expectedDays: trip.durationDays,
            actualDays: object.days.length,
          });
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
