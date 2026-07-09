"use client";

import { useState, type FormEvent } from "react";

import { formatBudget } from "@/components/trip-card";
import {
  dayCost,
  DISCLAIMER,
  tripTotalCost,
} from "@/components/itinerary-view";
import type {
  Itinerary,
  ItineraryActivity,
  ItineraryDay,
} from "@/lib/trips/itinerary";

const inputClassName =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";
const secondaryButtonClassName =
  "rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300";
const primaryButtonClassName =
  "rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900";
const removeButtonClassName =
  "rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 disabled:opacity-60 dark:border-red-800 dark:text-red-400";

type DraftActivity = {
  name: string;
  description: string;
  approxCostEur: string;
};

function parseDraftCost(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function withCoherentTotal(itinerary: Itinerary): Itinerary {
  return {
    ...itinerary,
    totalApproxCostEur: tripTotalCost(itinerary),
  };
}

function displayDayCost(
  day: ItineraryDay,
  dayIndex: number,
  editKey: string | null,
  draftCostStr: string,
): number {
  const draftCost = parseDraftCost(draftCostStr);
  if (editKey === `new-activity-${dayIndex}`) {
    return dayCost(day.activities) + draftCost;
  }
  const match = editKey?.match(/^activity-(\d+)-(\d+)$/);
  if (match && Number(match[1]) === dayIndex) {
    const actIndex = Number(match[2]);
    return day.activities.reduce((sum, activity, j) => {
      const cost = j === actIndex ? draftCost : activity.approxCostEur;
      return sum + cost;
    }, 0);
  }
  return dayCost(day.activities);
}

function displayTripTotal(
  itinerary: Itinerary,
  editKey: string | null,
  draftCostStr: string,
): number {
  return itinerary.days.reduce(
    (sum, day, i) => sum + displayDayCost(day, i, editKey, draftCostStr),
    0,
  );
}

function isCostPreviewKey(editKey: string | null): boolean {
  return (
    editKey != null &&
    (editKey.startsWith("activity-") || editKey.startsWith("new-activity-"))
  );
}

export function ItineraryEditor({
  tripId,
  initialItinerary,
}: {
  tripId: string;
  initialItinerary: Itinerary;
}) {
  const [itinerary, setItinerary] = useState(initialItinerary);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftActivity, setDraftActivity] = useState<DraftActivity>({
    name: "",
    description: "",
    approxCostEur: "0",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const controlsDisabled = pending;

  function openDayEdit(dayIndex: number, title: string) {
    setEditKey(`day-${dayIndex}`);
    setDraftTitle(title);
    setError(null);
  }

  function openActivityEdit(dayIndex: number, actIndex: number, activity: ItineraryActivity) {
    setEditKey(`activity-${dayIndex}-${actIndex}`);
    setDraftActivity({
      name: activity.name,
      description: activity.description,
      approxCostEur: String(activity.approxCostEur),
    });
    setError(null);
  }

  function openNewActivity(dayIndex: number) {
    setEditKey(`new-activity-${dayIndex}`);
    setDraftActivity({ name: "", description: "", approxCostEur: "0" });
    setError(null);
  }

  function cancelEdit() {
    setEditKey(null);
    setError(null);
  }

  async function persist(updated: Itinerary) {
    const body = withCoherentTotal(updated);
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
      setEditKey(null);
    } catch {
      setError("Network error — please try again");
    } finally {
      setPending(false);
    }
  }

  async function handleDaySave(e: FormEvent, dayIndex: number) {
    e.preventDefault();
    const updated: Itinerary = {
      ...itinerary,
      days: itinerary.days.map((day, i) =>
        i === dayIndex ? { ...day, title: draftTitle.trim() } : day,
      ),
    };
    await persist(updated);
  }

  async function handleActivitySave(
    e: FormEvent,
    dayIndex: number,
    actIndex: number | null,
  ) {
    e.preventDefault();
    const activity: ItineraryActivity = {
      name: draftActivity.name.trim(),
      description: draftActivity.description.trim(),
      approxCostEur: parseDraftCost(draftActivity.approxCostEur),
    };
    const updated: Itinerary = {
      ...itinerary,
      days: itinerary.days.map((day, i) => {
        if (i !== dayIndex) return day;
        if (actIndex == null) {
          return { ...day, activities: [...day.activities, activity] };
        }
        return {
          ...day,
          activities: day.activities.map((a, j) =>
            j === actIndex ? activity : a,
          ),
        };
      }),
    };
    await persist(updated);
  }

  async function handleRemove(dayIndex: number, actIndex: number) {
    const updated: Itinerary = {
      ...itinerary,
      days: itinerary.days.map((day, i) =>
        i === dayIndex
          ? {
              ...day,
              activities: day.activities.filter((_, j) => j !== actIndex),
            }
          : day,
      ),
    };
    setEditKey(null);
    await persist(updated);
  }

  const tripTotal = isCostPreviewKey(editKey)
    ? displayTripTotal(itinerary, editKey, draftActivity.approxCostEur)
    : tripTotalCost(itinerary);

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <p
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <ul className="flex flex-col gap-4">
        {itinerary.days.map((day, dayIndex) => {
          const dayKey = `day-${dayIndex}`;
          const isDayEditing = editKey === dayKey;
          const dayTotal = displayDayCost(
            day,
            dayIndex,
            editKey,
            draftActivity.approxCostEur,
          );

          return (
            <li
              key={dayIndex}
              className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
            >
              {isDayEditing ? (
                <form
                  className="flex flex-col gap-3"
                  onSubmit={(e) => void handleDaySave(e, dayIndex)}
                >
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      Day {day.day} title
                    </span>
                    <input
                      type="text"
                      required
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      className={inputClassName}
                    />
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={controlsDisabled}
                      className={primaryButtonClassName}
                    >
                      {pending ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      disabled={controlsDisabled}
                      onClick={cancelEdit}
                      className={secondaryButtonClassName}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
                    Day {day.day}
                    {day.title ? ` · ${day.title}` : ""}
                  </h3>
                  <div className="flex shrink-0 items-center gap-2">
                    {day.activities.length > 0 ? (
                      <span className="text-sm text-zinc-500 dark:text-zinc-400">
                        {formatBudget(dayTotal)}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      disabled={controlsDisabled}
                      onClick={() => openDayEdit(dayIndex, day.title)}
                      className={secondaryButtonClassName}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              )}

              <ul className="mt-3 flex flex-col gap-3">
                {day.activities.map((activity, actIndex) => {
                  const activityKey = `activity-${dayIndex}-${actIndex}`;
                  const isEditing = editKey === activityKey;

                  if (isEditing) {
                    return (
                      <li key={actIndex}>
                        <form
                          className="flex flex-col gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
                          onSubmit={(e) =>
                            void handleActivitySave(e, dayIndex, actIndex)
                          }
                        >
                          <label className="flex flex-col gap-1 text-sm">
                            <span className="font-medium text-zinc-700 dark:text-zinc-300">
                              Name
                            </span>
                            <input
                              type="text"
                              required
                              value={draftActivity.name}
                              onChange={(e) =>
                                setDraftActivity((d) => ({
                                  ...d,
                                  name: e.target.value,
                                }))
                              }
                              className={inputClassName}
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-sm">
                            <span className="font-medium text-zinc-700 dark:text-zinc-300">
                              Description
                            </span>
                            <input
                              type="text"
                              required
                              value={draftActivity.description}
                              onChange={(e) =>
                                setDraftActivity((d) => ({
                                  ...d,
                                  description: e.target.value,
                                }))
                              }
                              className={inputClassName}
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-sm">
                            <span className="font-medium text-zinc-700 dark:text-zinc-300">
                              Cost (EUR)
                            </span>
                            <input
                              type="number"
                              required
                              min={0}
                              step={1}
                              value={draftActivity.approxCostEur}
                              onChange={(e) =>
                                setDraftActivity((d) => ({
                                  ...d,
                                  approxCostEur: e.target.value,
                                }))
                              }
                              className={inputClassName}
                            />
                          </label>
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              disabled={controlsDisabled}
                              className={primaryButtonClassName}
                            >
                              {pending ? "Saving…" : "Save"}
                            </button>
                            <button
                              type="button"
                              disabled={controlsDisabled}
                              onClick={cancelEdit}
                              className={secondaryButtonClassName}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      </li>
                    );
                  }

                  return (
                    <li
                      key={actIndex}
                      className="flex flex-col gap-2 text-sm sm:flex-row sm:items-start sm:justify-between"
                    >
                      <span className="text-zinc-700 dark:text-zinc-300">
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          {activity.name}
                        </span>
                        {activity.description ? ` — ${activity.description}` : ""}
                      </span>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-zinc-500 dark:text-zinc-400">
                          {formatBudget(activity.approxCostEur)}
                        </span>
                        <button
                          type="button"
                          disabled={controlsDisabled}
                          onClick={() =>
                            openActivityEdit(dayIndex, actIndex, activity)
                          }
                          className={secondaryButtonClassName}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={controlsDisabled}
                          onClick={() => void handleRemove(dayIndex, actIndex)}
                          className={removeButtonClassName}
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  );
                })}

                {editKey === `new-activity-${dayIndex}` ? (
                  <li>
                    <form
                      className="flex flex-col gap-3 rounded-md border border-dashed border-zinc-300 p-3 dark:border-zinc-700"
                      onSubmit={(e) => void handleActivitySave(e, dayIndex, null)}
                    >
                      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        New activity
                      </p>
                      <label className="flex flex-col gap-1 text-sm">
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">
                          Name
                        </span>
                        <input
                          type="text"
                          required
                          value={draftActivity.name}
                          onChange={(e) =>
                            setDraftActivity((d) => ({
                              ...d,
                              name: e.target.value,
                            }))
                          }
                          className={inputClassName}
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm">
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">
                          Description
                        </span>
                        <input
                          type="text"
                          required
                          value={draftActivity.description}
                          onChange={(e) =>
                            setDraftActivity((d) => ({
                              ...d,
                              description: e.target.value,
                            }))
                          }
                          className={inputClassName}
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm">
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">
                          Cost (EUR)
                        </span>
                        <input
                          type="number"
                          required
                          min={0}
                          step={1}
                          value={draftActivity.approxCostEur}
                          onChange={(e) =>
                            setDraftActivity((d) => ({
                              ...d,
                              approxCostEur: e.target.value,
                            }))
                          }
                          className={inputClassName}
                        />
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={controlsDisabled}
                          className={primaryButtonClassName}
                        >
                          {pending ? "Saving…" : "Save"}
                        </button>
                        <button
                          type="button"
                          disabled={controlsDisabled}
                          onClick={cancelEdit}
                          className={secondaryButtonClassName}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </li>
                ) : (
                  <li>
                    <button
                      type="button"
                      disabled={controlsDisabled}
                      onClick={() => openNewActivity(dayIndex)}
                      className={secondaryButtonClassName}
                    >
                      Add activity
                    </button>
                  </li>
                )}
              </ul>
            </li>
          );
        })}
      </ul>

      <p className="text-right font-medium text-zinc-900 dark:text-zinc-50">
        Estimated total: {formatBudget(tripTotal)}
      </p>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">{DISCLAIMER}</p>
    </div>
  );
}
