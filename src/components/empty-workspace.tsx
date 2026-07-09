"use client";

import { useState } from "react";

import { MapPinIcon, PlusIcon, SuitcaseIcon } from "@/components/icons";
import { TripCreateModal } from "@/components/trip-create-modal";

export function EmptyWorkspace() {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <div className="relative flex h-full min-h-[480px] items-center justify-center overflow-hidden p-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(circle at 20% 20%, rgba(255,122,61,0.12), transparent 40%), radial-gradient(circle at 80% 80%, rgba(255,194,140,0.2), transparent 35%)",
          }}
        />

        <div className="relative max-w-md text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] bg-white shadow-[0_20px_60px_rgba(49,33,20,0.08)]">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(255,122,61,0.14)] text-[var(--primary)]">
              <SuitcaseIcon className="h-6 w-6" />
            </span>
          </div>

          <h1 className="mt-8 text-3xl font-black tracking-tight text-[var(--foreground)]">
            Plan your first city break
          </h1>
          <p className="mx-auto mt-3 max-w-sm leading-relaxed text-[var(--muted)]">
            Create a trip, generate a day-by-day itinerary with AI, then
            customize activities and costs.
          </p>

          <button
            type="button"
            className="btn-primary mx-auto mt-8 inline-flex items-center gap-2 px-8"
            onClick={() => setCreateOpen(true)}
          >
            <PlusIcon />
            Create trip
          </button>

          <div className="mt-10 grid gap-3 text-left">
            {[
              "Pick a destination and budget",
              "Generate an AI itinerary in seconds",
              "Edit days, activities, and costs",
            ].map((step, i) => (
              <div
                key={step}
                className="flex items-center gap-3 rounded-2xl border border-[var(--border-muted)] bg-white/80 px-4 py-3 text-sm text-[var(--foreground)] backdrop-blur"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-xs font-black text-[var(--primary-foreground)]">
                  {i + 1}
                </span>
                {step}
              </div>
            ))}
          </div>
        </div>
      </div>

      <TripCreateModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

export function WorkspacePlaceholder() {
  return (
    <div className="flex h-full min-h-[480px] flex-col items-center justify-center p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[rgba(255,122,61,0.12)] text-[var(--primary)]">
        <MapPinIcon className="h-8 w-8" />
      </div>
      <h2 className="mt-6 text-xl font-black text-[var(--foreground)]">
        Select a trip to get started
      </h2>
      <p className="mt-2 max-w-sm text-sm text-[var(--muted)]">
        Choose a destination from the list on the left to view and edit your
        itinerary.
      </p>
    </div>
  );
}
