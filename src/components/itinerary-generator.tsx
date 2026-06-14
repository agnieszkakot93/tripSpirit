"use client";

import { experimental_useObject as useObject } from "@ai-sdk/react";
import { useState } from "react";

import { ItineraryView } from "@/components/itinerary-view";
import { itinerarySchema } from "@/lib/trips/itinerary";

export function ItineraryGenerator({ tripId }: { tripId: string }) {
  const [started, setStarted] = useState(false);
  // The route returns 200 with an empty stream when generation fails server-side
  // (e.g. OpenAI error/timeout), so "finished with no object" is also an error.
  const [emptyError, setEmptyError] = useState(false);

  const { submit, object, isLoading, error } = useObject({
    api: `/api/trips/${tripId}/itinerary`,
    schema: itinerarySchema,
    onFinish: ({ object }) => {
      if (!object) setEmptyError(true);
    },
  });

  const failed = Boolean(error) || emptyError;

  function generate() {
    setStarted(true);
    setEmptyError(false);
    submit({});
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
          Itinerary
        </h2>
        {isLoading ? (
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            Generating…
          </span>
        ) : null}
      </div>

      {!started ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No itinerary yet. Generate a day-by-day plan for this trip.
          </p>
          <button
            type="button"
            onClick={generate}
            className="mt-3 rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Generate itinerary
          </button>
        </div>
      ) : null}

      {object ? <ItineraryView itinerary={object} /> : null}

      {failed ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900 dark:bg-red-950">
          <p className="text-sm text-red-800 dark:text-red-200" role="alert">
            Generation failed — please try again.
          </p>
          <button
            type="button"
            onClick={generate}
            disabled={isLoading}
            className="mt-2 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Try again
          </button>
        </div>
      ) : null}
    </section>
  );
}
