"use client";

import { useState } from "react";

import { PlusIcon } from "@/components/icons";
import { TripCreateModal } from "@/components/trip-create-modal";

function EmptyIllustration() {
  return (
    <svg
      viewBox="0 0 200 140"
      className="mx-auto h-36 w-56"
      fill="none"
      aria-hidden
    >
      <ellipse cx="100" cy="120" rx="70" ry="8" fill="#f0e8dc" />
      <rect
        x="55"
        y="45"
        width="90"
        height="60"
        rx="8"
        fill="#fffaf3"
        stroke="#ded6ca"
        strokeWidth="1.5"
      />
      <path
        d="M70 85 L100 55 L130 85 Z"
        fill="#ff7a3d"
        opacity="0.25"
      />
      <circle cx="100" cy="68" r="6" fill="#ff7a3d" />
      <rect
        x="130"
        y="60"
        width="28"
        height="22"
        rx="4"
        fill="#e8dfd3"
        stroke="#ded6ca"
      />
      <circle cx="144" cy="71" r="5" fill="#c4b8a8" />
      <path
        d="M40 95 Q50 75 65 90 T90 88"
        stroke="#c8e6c9"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M115 92 Q125 78 140 90"
        stroke="#c8e6c9"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function EmptyWorkspace() {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <div className="flex h-full min-h-[520px] items-center justify-center">
        <div className="relative w-full max-w-lg rounded-[32px] border border-dashed border-[var(--border)] bg-white px-10 py-12 text-center shadow-[0_20px_60px_rgba(49,33,20,0.05)]">
          <EmptyIllustration />

          <h2 className="mt-6 text-2xl font-black tracking-tight text-[var(--foreground)]">
            Plan your first city break
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-[var(--muted)]">
            Your AI-generated city-break itinerary will appear here. Create a
            trip to get started.
          </p>

          <button
            type="button"
            className="btn-primary mx-auto mt-8 inline-flex items-center gap-2 px-8"
            onClick={() => setCreateOpen(true)}
          >
            <PlusIcon />
            Create trip
          </button>

          <p
            className="pointer-events-none mt-8 text-lg text-[#c4a882]"
            style={{ fontFamily: "cursive" }}
          >
            Let&apos;s plan your next adventure ✈️
          </p>
        </div>
      </div>

      <TripCreateModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

export function WorkspacePlaceholder() {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <div className="flex h-full min-h-[520px] items-center justify-center">
        <div className="relative w-full max-w-lg rounded-[32px] border border-dashed border-[var(--border)] bg-white px-10 py-12 text-center shadow-[0_20px_60px_rgba(49,33,20,0.05)]">
          <EmptyIllustration />

          <h2 className="mt-6 text-2xl font-black tracking-tight text-[var(--foreground)]">
            Select or create a trip
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-[var(--muted)]">
            Your AI-generated city-break itinerary will appear here. Pick a trip
            from the list or create a new one.
          </p>

          <button
            type="button"
            className="btn-primary mx-auto mt-8 inline-flex items-center gap-2 px-8"
            onClick={() => setCreateOpen(true)}
          >
            <PlusIcon />
            Create trip
          </button>

          <p
            className="pointer-events-none mt-8 text-lg text-[#c4a882]"
            style={{ fontFamily: "cursive" }}
          >
            Let&apos;s plan your next adventure ✈️
          </p>
        </div>
      </div>

      <TripCreateModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
