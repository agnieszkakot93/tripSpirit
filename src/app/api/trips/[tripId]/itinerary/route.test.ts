import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppDatabase } from "@/lib/db";
import type { Itinerary } from "@/lib/trips/itinerary";
import { getTripForUser, updateTripItinerary } from "@/lib/trips/queries";
import {
  seedTrip,
  seedUser,
  setupRouteTest,
  type MockSession,
} from "@/test/route-harness";

/** Literal trip-duration oracle matching seeded trips (Risk #3). */
const TRIP_DURATION_DAYS = 3;

type StreamObjectOptions = {
  abortSignal?: AbortSignal;
  onFinish?: (event: { object: Itinerary | undefined }) => void;
  onError?: (event: { error: unknown }) => void;
};

const {
  mockStreamObject,
  cfState,
  waitUntilPromises,
  lastStreamObjectOptions,
} = vi.hoisted(() => {
  const waitUntilPromises: Promise<unknown>[] = [];
  const lastStreamObjectOptions: { current: StreamObjectOptions | null } = {
    current: null,
  };
  const cfState = {
    openaiApiKey: "test-openai-key" as string | undefined,
  };
  return {
    waitUntilPromises,
    lastStreamObjectOptions,
    cfState,
    mockStreamObject: vi.fn((options: StreamObjectOptions) => {
      lastStreamObjectOptions.current = options;
      return {
        toTextStreamResponse: () =>
          new Response("", {
            status: 200,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          }),
      };
    }),
  };
});

vi.mock("@/lib/auth", async () => {
  const harness = await import("@/test/route-harness");
  return { auth: harness.mockAuth };
});

vi.mock("@/lib/db", async () => {
  const harness = await import("@/test/route-harness");
  return { getDb: harness.mockGetDb };
});

vi.mock("@/lib/cloudflare-context", () => ({
  getAppCloudflareContext: async () => ({
    env: { OPENAI_API_KEY: cfState.openaiApiKey },
    cf: {},
    ctx: {
      waitUntil: (promise: Promise<unknown>) => {
        waitUntilPromises.push(promise);
      },
    },
  }),
}));

vi.mock("ai", () => ({
  streamObject: mockStreamObject,
}));

import { PATCH, POST } from "./route";

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

function tripParams(tripId: string) {
  return { params: Promise.resolve({ tripId }) };
}

function postRequest(tripId: string) {
  return new Request(`http://localhost/api/trips/${tripId}/itinerary`, {
    method: "POST",
  });
}

function patchRequest(tripId: string, body: unknown) {
  return new Request(`http://localhost/api/trips/${tripId}/itinerary`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function patchRawRequest(tripId: string, body: string) {
  return new Request(`http://localhost/api/trips/${tripId}/itinerary`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

async function flushWaitUntil() {
  await Promise.all([...waitUntilPromises]);
  waitUntilPromises.length = 0;
}

describe("/api/trips/[tripId]/itinerary — generation + shape contract", () => {
  let db: AppDatabase;
  let tripId: string;
  let setSession: (session: MockSession) => void;

  beforeEach(async () => {
    ({ db, setSession } = setupRouteTest());
    seedUser(db, "u1");
    const trip = await seedTrip(db, "u1", {
      destination: "Lisbon",
      durationDays: TRIP_DURATION_DAYS,
      budgetAmount: 1000,
    });
    tripId = trip.id;

    cfState.openaiApiKey = "test-openai-key";
    waitUntilPromises.length = 0;
    lastStreamObjectOptions.current = null;
    mockStreamObject.mockClear();
  });

  it("POST unauthenticated returns 401 Unauthorized (Risk #5 residual)", async () => {
    setSession(null);
    const res = await POST(postRequest(tripId), tripParams(tripId));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
    expect(mockStreamObject).not.toHaveBeenCalled();
  });

  it("POST as wrong owner returns 404 and does not start generation (guardrail)", async () => {
    seedUser(db, "u2");
    setSession({ user: { id: "u2" } });
    const res = await POST(postRequest(tripId), tripParams(tripId));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
    expect(mockStreamObject).not.toHaveBeenCalled();
    const row = await getTripForUser(db, "u1", tripId);
    expect(row?.itineraryJson).toBeNull();
  });

  it("POST for a missing trip returns 404 and does not start generation (FR-009)", async () => {
    setSession({ user: { id: "u1" } });
    const missingTripId = "00000000-0000-4000-8000-000000000000";
    const res = await POST(postRequest(missingTripId), tripParams(missingTripId));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
    expect(mockStreamObject).not.toHaveBeenCalled();
  });

  it("PATCH unauthenticated returns 401 Unauthorized (Risk #5 residual)", async () => {
    setSession(null);
    const res = await PATCH(
      patchRequest(tripId, sampleItinerary(TRIP_DURATION_DAYS)),
      tripParams(tripId),
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("POST when itinerary already exists returns 409 and leaves row unchanged (one-shot)", async () => {
    setSession({ user: { id: "u1" } });
    const existing = sampleItinerary(TRIP_DURATION_DAYS);
    await updateTripItinerary(db, "u1", tripId, existing);
    const before = await getTripForUser(db, "u1", tripId);

    const res = await POST(postRequest(tripId), tripParams(tripId));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Itinerary already generated" });
    expect(mockStreamObject).not.toHaveBeenCalled();

    const after = await getTripForUser(db, "u1", tripId);
    expect(after?.itineraryJson).toBe(before?.itineraryJson);
  });

  it("POST missing OPENAI_API_KEY returns 500 before streaming", async () => {
    setSession({ user: { id: "u1" } });
    cfState.openaiApiKey = undefined;

    const res = await POST(postRequest(tripId), tripParams(tripId));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Internal error" });
    expect(mockStreamObject).not.toHaveBeenCalled();

    const row = await getTripForUser(db, "u1", tripId);
    expect(row?.itineraryJson).toBeNull();
  });

  it("empty/abort onFinish leaves itinerary_json null (Risk #2 no partial persist)", async () => {
    setSession({ user: { id: "u1" } });
    const originalTimeout = AbortSignal.timeout.bind(AbortSignal);
    const timeoutSpy = vi
      .spyOn(AbortSignal, "timeout")
      .mockImplementation(() => originalTimeout(50));

    try {
      const res = await POST(postRequest(tripId), tripParams(tripId));
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toMatch(/text\/plain/);
      expect(timeoutSpy).toHaveBeenCalled();
      expect(lastStreamObjectOptions.current?.abortSignal).toBeDefined();
      expect(lastStreamObjectOptions.current?.onFinish).toBeTypeOf("function");

      lastStreamObjectOptions.current?.onFinish?.({ object: undefined });
      await flushWaitUntil();

      const row = await getTripForUser(db, "u1", tripId);
      expect(row?.itineraryJson).toBeNull();
    } finally {
      timeoutSpy.mockRestore();
    }
  });

  it("incomplete onFinish day-count mismatch never persists (Risk #3 wire-up)", async () => {
    setSession({ user: { id: "u1" } });

    const res = await POST(postRequest(tripId), tripParams(tripId));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/plain/);

    lastStreamObjectOptions.current?.onFinish?.({
      object: sampleItinerary(TRIP_DURATION_DAYS - 1),
    });
    await flushWaitUntil();

    const row = await getTripForUser(db, "u1", tripId);
    expect(row?.itineraryJson).toBeNull();
  });

  it("complete onFinish persists itinerary_json (Risk #3 matching shape accepted)", async () => {
    setSession({ user: { id: "u1" } });
    const complete = sampleItinerary(TRIP_DURATION_DAYS);

    const res = await POST(postRequest(tripId), tripParams(tripId));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/plain/);

    lastStreamObjectOptions.current?.onFinish?.({ object: complete });
    await flushWaitUntil();

    const row = await getTripForUser(db, "u1", tripId);
    expect(row?.itineraryJson).not.toBeNull();
    expect(JSON.parse(row!.itineraryJson!)).toEqual(complete);
  });
});

describe("/api/trips/[tripId]/itinerary — PATCH ownership + persist (Risk #6)", () => {
  let db: AppDatabase;
  let tripId: string;
  let setSession: (session: MockSession) => void;
  const initialItinerary = sampleItinerary(TRIP_DURATION_DAYS);

  beforeEach(async () => {
    ({ db, setSession } = setupRouteTest());
    seedUser(db, "u1");
    seedUser(db, "u2");
    const trip = await seedTrip(db, "u1", {
      destination: "Lisbon",
      durationDays: TRIP_DURATION_DAYS,
      budgetAmount: 1000,
    });
    tripId = trip.id;
    await updateTripItinerary(db, "u1", tripId, initialItinerary);
  });

  it("PATCH as wrong owner returns 404 and leaves itinerary_json unchanged", async () => {
    setSession({ user: { id: "u2" } });
    const edited = sampleItinerary(TRIP_DURATION_DAYS);
    edited.days[0]!.activities[0]!.name = "Hijacked";

    const res = await PATCH(patchRequest(tripId, edited), tripParams(tripId));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });

    const row = await getTripForUser(db, "u1", tripId);
    expect(JSON.parse(row!.itineraryJson!)).toEqual(initialItinerary);
  });

  it("PATCH for a missing trip returns 404", async () => {
    setSession({ user: { id: "u1" } });
    const missingTripId = "00000000-0000-4000-8000-000000000000";

    const res = await PATCH(
      patchRequest(missingTripId, initialItinerary),
      tripParams(missingTripId),
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
  });

  it("PATCH returns 400 for invalid JSON or itinerary shape", async () => {
    setSession({ user: { id: "u1" } });

    const badJson = await PATCH(patchRawRequest(tripId, "{"), tripParams(tripId));
    expect(badJson.status).toBe(400);
    expect(await badJson.json()).toEqual({ error: "Invalid JSON body" });

    const emptyDays = await PATCH(patchRequest(tripId, { days: [] }), tripParams(tripId));
    expect(emptyDays.status).toBe(400);
    expect(await emptyDays.json()).toEqual({ error: "Invalid itinerary" });

    const row = await getTripForUser(db, "u1", tripId);
    expect(JSON.parse(row!.itineraryJson!)).toEqual(initialItinerary);
  });

  it("PATCH as owner returns 204 and DB read-back reflects the saved itinerary", async () => {
    setSession({ user: { id: "u1" } });
    const updated = sampleItinerary(TRIP_DURATION_DAYS);
    updated.days[0]!.activities[0]!.name = "Edited Belem walk";
    updated.days[0]!.activities[0]!.approxCostEur = 25;
    updated.totalApproxCostEur = 85;

    const res = await PATCH(patchRequest(tripId, updated), tripParams(tripId));
    expect(res.status).toBe(204);
    expect(res.body).toBeNull();

    const row = await getTripForUser(db, "u1", tripId);
    expect(JSON.parse(row!.itineraryJson!)).toEqual(updated);
  });
});
