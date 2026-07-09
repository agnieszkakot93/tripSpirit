"use client";

import { useState, type FormEvent } from "react";

import { ChevronIcon, TrashIcon } from "@/components/icons";
import {
  dayCost,
  DISCLAIMER,
  tripTotalCost,
} from "@/components/itinerary-view";
import { formatBudget } from "@/lib/format";
import type {
  Itinerary,
  ItineraryActivity,
  ItineraryDay,
} from "@/lib/trips/itinerary";

function withCoherentTotal(itinerary: Itinerary): Itinerary {
  return {
    ...itinerary,
    totalApproxCostEur: tripTotalCost(itinerary),
  };
}

export function ItineraryEditor({
  tripId,
  initialItinerary,
}: {
  tripId: string;
  initialItinerary: Itinerary;
  budgetAmount?: number;
}) {
  const [itinerary, setItinerary] = useState(initialItinerary);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set([0]));
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function toggleDay(index: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function updateDay(dayIndex: number, patch: Partial<ItineraryDay>) {
    setItinerary((prev) => ({
      ...prev,
      days: prev.days.map((day, i) =>
        i === dayIndex ? { ...day, ...patch } : day,
      ),
    }));
    setDirty(true);
  }

  function updateActivity(
    dayIndex: number,
    actIndex: number,
    patch: Partial<ItineraryActivity>,
  ) {
    setItinerary((prev) => ({
      ...prev,
      days: prev.days.map((day, i) => {
        if (i !== dayIndex) return day;
        return {
          ...day,
          activities: day.activities.map((activity, j) =>
            j === actIndex ? { ...activity, ...patch } : activity,
          ),
        };
      }),
    }));
    setDirty(true);
  }

  function addActivity(dayIndex: number) {
    setItinerary((prev) => ({
      ...prev,
      days: prev.days.map((day, i) =>
        i === dayIndex
          ? {
              ...day,
              activities: [
                ...day.activities,
                { name: "New activity", description: "", approxCostEur: 0 },
              ],
            }
          : day,
      ),
    }));
    setExpanded((prev) => new Set(prev).add(dayIndex));
    setDirty(true);
  }

  function removeActivity(dayIndex: number, actIndex: number) {
    setItinerary((prev) => ({
      ...prev,
      days: prev.days.map((day, i) =>
        i === dayIndex
          ? {
              ...day,
              activities: day.activities.filter((_, j) => j !== actIndex),
            }
          : day,
      ),
    }));
    setDirty(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    const body = withCoherentTotal(itinerary);
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/itinerary`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not save itinerary");
        return;
      }
      setItinerary(body);
      setDirty(false);
    } catch {
      setError("Network error — please try again");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="grid gap-5 pb-4" onSubmit={handleSave}>
      {error ? (
        <p className="alert-error" role="alert">
          {error}
        </p>
      ) : null}

      {itinerary.days.map((day, dayIndex) => {
        const isOpen = expanded.has(dayIndex);
        const cost = dayCost(day.activities);

        return (
          <section
            key={dayIndex}
            className="overflow-hidden rounded-[28px] border border-[var(--border-muted)] bg-white shadow-[0_20px_60px_rgba(49,33,20,0.07)]"
          >
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
              onClick={() => toggleDay(dayIndex)}
            >
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted-light)]">
                  Day {day.day}
                </p>
                <h3 className="mt-1 text-xl font-black tracking-tight text-[var(--foreground)]">
                  {day.title || `Day ${day.day}`}
                </h3>
              </div>
              <div className="flex items-center gap-3">
                {!isOpen ? (
                  <span className="text-sm text-[var(--muted)]">
                    Est. {formatBudget(cost)}
                  </span>
                ) : null}
                <ChevronIcon expanded={isOpen} className="text-[var(--muted)]" />
              </div>
            </button>

            {isOpen ? (
              <div className="border-t border-[var(--border-muted)] px-6 pb-6 pt-4">
                <input
                  className="field-input field-title mb-4 text-xl font-black"
                  value={day.title}
                  onChange={(e) =>
                    updateDay(dayIndex, { title: e.target.value })
                  }
                  placeholder={`Day ${day.day} title`}
                />

                <ul className="grid gap-3">
                  {day.activities.map((activity, actIndex) => (
                    <li
                      key={actIndex}
                      className="grid gap-3 rounded-[22px] bg-[var(--surface-muted)] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <input
                          className="field-input font-bold"
                          value={activity.name}
                          onChange={(e) =>
                            updateActivity(dayIndex, actIndex, {
                              name: e.target.value,
                            })
                          }
                        />
                        <button
                          type="button"
                          className="btn-ghost shrink-0 rounded-xl p-2 text-[var(--muted)] hover:text-red-600"
                          onClick={() => removeActivity(dayIndex, actIndex)}
                          aria-label="Remove activity"
                        >
                          <TrashIcon />
                        </button>
                      </div>

                      <textarea
                        className="field-input field-textarea"
                        value={activity.description}
                        onChange={(e) =>
                          updateActivity(dayIndex, actIndex, {
                            description: e.target.value,
                          })
                        }
                        placeholder="Description"
                      />

                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          className="field-input max-w-[120px]"
                          value={activity.approxCostEur}
                          onChange={(e) =>
                            updateActivity(dayIndex, actIndex, {
                              approxCostEur: Number(e.target.value) || 0,
                            })
                          }
                        />
                        <span className="text-sm text-[var(--muted-light)]">
                          approx. cost
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  className="btn-dashed mt-4"
                  onClick={() => addActivity(dayIndex)}
                >
                  + Add activity
                </button>
              </div>
            ) : null}
          </section>
        );
      })}

      <p className="text-xs text-[var(--muted-light)]">{DISCLAIMER}</p>

      {dirty ? (
        <div className="sticky bottom-4 flex justify-end">
          <button type="submit" disabled={pending} className="btn-primary px-8">
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      ) : null}
    </form>
  );
}
