"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

interface TripActionsProps {
  id: string;
  destination: string;
  durationDays: number;
  budgetAmount: number;
}

export function TripActions({
  id,
  destination: initialDestination,
  durationDays: initialDuration,
  budgetAmount: initialBudget,
}: TripActionsProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [destination, setDestination] = useState(String(initialDestination));
  const [durationDays, setDurationDays] = useState(String(initialDuration));
  const [budgetAmount, setBudgetAmount] = useState(String(initialBudget));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function handleEditOpen() {
    setDestination(String(initialDestination));
    setDurationDays(String(initialDuration));
    setBudgetAmount(String(initialBudget));
    setError(null);
    setEditing(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/trips/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: destination.trim(),
          durationDays: Number(durationDays),
          budgetAmount: Number(budgetAmount),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not update trip");
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setPending(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete "${initialDestination}"? This will permanently remove the trip and its itinerary.`,
    );
    if (!confirmed) return;
    setPending(true);
    try {
      const res = await fetch(`/api/trips/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not delete trip");
        setPending(false);
        return;
      }
      router.push("/trips");
      router.refresh();
    } catch {
      setError("Network error — please try again");
      setPending(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex flex-col gap-2">
        {error ? (
          <p
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <div className="flex gap-3">
          <button
            onClick={handleEditOpen}
            disabled={pending}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300"
          >
            Edit
          </button>
          <button
            onClick={handleDelete}
            disabled={pending}
            className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-60 dark:border-red-800 dark:text-red-400"
          >
            Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
      onSubmit={handleSave}
    >
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
        Edit trip
      </h2>

      {error ? (
        <p
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">
          Destination
        </span>
        <input
          type="text"
          required
          maxLength={120}
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">
          Duration (days)
        </span>
        <input
          type="number"
          required
          min={1}
          max={14}
          step={1}
          value={durationDays}
          onChange={(e) => setDurationDays(e.target.value)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">
          Budget (EUR)
        </span>
        <input
          type="number"
          required
          min={1}
          max={50000}
          step={1}
          value={budgetAmount}
          onChange={(e) => setBudgetAmount(e.target.value)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        />
      </label>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setEditing(false)}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
