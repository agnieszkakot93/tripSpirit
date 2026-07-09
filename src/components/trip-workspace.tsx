"use client";

import { useState } from "react";

import { BudgetOverview } from "@/components/budget-overview";
import { PencilIcon } from "@/components/icons";
import { ItineraryEditor } from "@/components/itinerary-editor";
import { ItineraryGenerator } from "@/components/itinerary-generator";
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
    <div className="flex h-full flex-col">
      <div className="relative shrink-0">
        <div
          className="h-48 bg-cover bg-center"
          style={{
            backgroundImage: `linear-gradient(to bottom, rgba(24,20,17,0.15), rgba(24,20,17,0.55)), url('${destinationImageUrl(destination)}')`,
          }}
        />

        <div className="absolute inset-x-6 -bottom-12 rounded-[24px] border border-[var(--border-muted)] bg-white p-5 shadow-[0_16px_48px_rgba(49,33,20,0.1)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-black tracking-tight text-[var(--foreground)]">
                  {destination}
                </h1>
                <PencilIcon className="text-[var(--muted-light)]" />
              </div>
              <p className="mt-2 text-[var(--muted)]">
                {formatDuration(durationDays)} · Budget{" "}
                {formatBudget(budgetAmount)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-20 flex flex-1 flex-col px-6 pb-6">
        <div className="flex gap-6 border-b border-[var(--border-muted)]">
          {(["itinerary", "overview"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`border-b-2 pb-3 text-sm font-bold capitalize transition-colors ${
                tab === t
                  ? "border-[var(--primary)] text-[var(--foreground)]"
                  : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="mt-6 flex-1">
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

      {itinerary ? (
        <footer className="sticky bottom-0 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--border-muted)] bg-white/95 px-8 py-4 backdrop-blur">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-[var(--muted)]">
              Total estimated cost{" "}
              <strong className="text-[var(--foreground)]">
                {formatBudget(totalCost)}
              </strong>{" "}
              / {formatBudget(budgetAmount)}
            </span>
            {withinBudget ? (
              <span className="badge-success">
                Within budget
              </span>
            ) : (
              <span className="badge-warning">
                Over budget
              </span>
            )}
          </div>
        </footer>
      ) : null}
    </div>
  );
}
