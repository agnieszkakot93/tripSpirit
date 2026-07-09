"use client";

import { experimental_useObject as useObject } from "@ai-sdk/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ItineraryView } from "@/components/itinerary-view";
import { Loader } from "@/components/loader";
import { itinerarySchema } from "@/lib/trips/itinerary";

export function ItineraryGenerator({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [emptyError, setEmptyError] = useState(false);

  const { submit, object, isLoading, error } = useObject({
    api: `/api/trips/${tripId}/itinerary`,
    schema: itinerarySchema,
    onFinish: ({ object: finished }) => {
      if (!finished) {
        setEmptyError(true);
        return;
      }
      router.refresh();
    },
  });

  const failed = Boolean(error) || emptyError;

  function generate() {
    setStarted(true);
    setEmptyError(false);
    submit({});
  }

  return (
    <section className="grid gap-6">
      {!started ? (
        <div className="rounded-[28px] border border-dashed border-[var(--border)] bg-white px-8 py-16 text-center">
          <h2 className="text-xl font-black text-[var(--foreground)]">
            No itinerary yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">
            Generate a day-by-day plan with activities and approximate costs
            tailored to your destination, duration, and budget.
          </p>
          <button
            type="button"
            onClick={generate}
            className="btn-primary mt-6"
          >
            Generate itinerary
          </button>
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-[28px] border border-[var(--border-muted)] bg-white px-8 py-14">
          <Loader
            size="lg"
            label="Generating your itinerary…"
            className="mx-auto"
          />
          <p className="mx-auto mt-4 max-w-sm text-center text-sm text-[var(--muted)]">
            AI is planning activities and costs for each day. This usually takes
            15–30 seconds.
          </p>
        </div>
      ) : null}

      {object ? <ItineraryView itinerary={object} /> : null}

      {failed ? (
        <div className="alert-error">
          <p role="alert">Generation failed — please try again.</p>
          <button
            type="button"
            onClick={generate}
            disabled={isLoading}
            className="btn-primary mt-3"
          >
            Try again
          </button>
        </div>
      ) : null}
    </section>
  );
}
