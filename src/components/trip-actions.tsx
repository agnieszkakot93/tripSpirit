"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { tripDeleteConfirmMessage } from "@/lib/trips/messages";

interface TripActionsProps {
  id: string;
  destination: string;
  durationDays: number;
  budgetAmount: number;
  hasItinerary?: boolean;
}

export function TripActions({
  id,
  destination: initialDestination,
  durationDays: initialDuration,
  budgetAmount: initialBudget,
  hasItinerary = false,
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
      tripDeleteConfirmMessage(initialDestination),
    );
    if (!confirmed) return;
    setPending(true);
    setError(null);
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
            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleEditOpen}
            disabled={pending}
            className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] disabled:opacity-60"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-60"
          >
            Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="flex w-full flex-col gap-4 rounded-2xl border border-[var(--border-muted)] bg-[var(--surface-muted)] p-5"
      onSubmit={handleSave}
    >
      <h2 className="text-lg font-bold text-[var(--foreground)]">Edit trip</h2>

      {error ? (
        <p
          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {hasItinerary ? (
        <p className="text-sm text-[var(--muted)]">
          Changing duration may leave the itinerary day count out of sync until you
          edit activities manually.
        </p>
      ) : null}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold text-[var(--foreground)]">Destination</span>
        <input
          type="text"
          required
          maxLength={120}
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-[var(--foreground)]"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold text-[var(--foreground)]">Duration (days)</span>
        <input
          type="number"
          required
          min={1}
          max={14}
          step={1}
          value={durationDays}
          onChange={(e) => setDurationDays(e.target.value)}
          className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-[var(--foreground)]"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold text-[var(--foreground)]">Budget (EUR)</span>
        <input
          type="number"
          required
          min={1}
          max={50000}
          step={1}
          value={budgetAmount}
          onChange={(e) => setBudgetAmount(e.target.value)}
          className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-[var(--foreground)]"
        />
      </label>

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setEditing(false)}
          className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
