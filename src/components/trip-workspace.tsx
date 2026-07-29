"use client";

import { useState } from "react";

import { BudgetOverview } from "@/components/budget-overview";
import { ItineraryEditor } from "@/components/itinerary-editor";
import { ItineraryGenerator } from "@/components/itinerary-generator";
import { TripActions } from "@/components/trip-actions";
import {
  ItineraryView,
  tripTotalCost,
  type PartialItinerary,
} from "@/components/itinerary-view";
import {
  destinationImageUrl,
  formatBudget,
  formatDuration,
} from "@/lib/format";
import type { Itinerary } from "@/lib/trips/itinerary";

type Tab = "itinerary" | "overview";

type TripWorkspaceProps = {
  tripId: string;
  destination: string;
  durationDays: number;
  budgetAmount: number;
  savedItinerary:
    | { valid: true; data: Itinerary }
    | { valid: false; data: PartialItinerary }
    | null;
};

export function TripWorkspace({
  tripId,
  destination,
  durationDays,
  budgetAmount,
  savedItinerary,
}: TripWorkspaceProps) {
  const [tab, setTab] = useState<Tab>("itinerary");

  const itinerary = savedItinerary?.valid ? savedItinerary.data : null;
  const totalCost = itinerary ? tripTotalCost(itinerary) : 0;
  const withinBudget = totalCost <= budgetAmount;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-[var(--border-muted)] bg-white shadow-[0_4px_24px_rgba(49,33,20,0.04)]">
      <header
        className="sticky top-0 z-20 shrink-0 border-b border-[var(--border-muted)] bg-white/95 backdrop-blur-sm"
      >
        <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
          <div className="flex min-w-0 gap-4">
            <div
              className="h-14 w-14 shrink-0 rounded-xl bg-cover bg-center ring-1 ring-black/5"
              style={{
                backgroundImage: `url('${destinationImageUrl(destination, 112)}')`,
              }}
            />
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-black tracking-tight text-[var(--foreground)]">
                {destination}
              </h1>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {formatDuration(durationDays)} · Budget {formatBudget(budgetAmount)}
              </p>
              {itinerary ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-sm text-[var(--muted)]">
                    Total est.{" "}
                    <strong className="text-[var(--foreground)]">
                      {formatBudget(totalCost)}
                    </strong>
                    {" / "}
                    {formatBudget(budgetAmount)}
                  </span>
                  {withinBudget ? (
                    <span className="badge-success">Within budget</span>
                  ) : (
                    <span className="badge-warning">Over budget</span>
                  )}
                </div>
              ) : null}
            </div>
          </div>
          <TripActions
            id={tripId}
            destination={destination}
            durationDays={durationDays}
            budgetAmount={budgetAmount}
            hasItinerary={savedItinerary !== null}
          />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 gap-6 border-b border-[var(--border-muted)] px-5">
          {(["itinerary", "overview"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`border-b-2 pb-3 pt-2 text-sm font-bold capitalize transition-colors ${
                tab === t
                  ? "border-[var(--primary)] text-[var(--foreground)]"
                  : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {tab === "itinerary" ? (
            savedItinerary ? (
              savedItinerary.valid ? (
                <ItineraryEditor
                  tripId={tripId}
                  initialItinerary={savedItinerary.data}
                  budgetAmount={budgetAmount}
                />
              ) : (
                <ItineraryView itinerary={savedItinerary.data} />
              )
            ) : (
              <ItineraryGenerator tripId={tripId} />
            )
          ) : (
            <BudgetOverview
              budgetAmount={budgetAmount}
              itinerary={itinerary}
            />
          )}
        </div>
      </div>
    </div>
  );
}
