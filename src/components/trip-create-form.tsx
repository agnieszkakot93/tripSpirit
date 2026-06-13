"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

// Wire format matches src/lib/trips/validation.ts: camelCase JSON keys,
// destination string, durationDays 1–14, budgetAmount 1–50000 (whole EUR).
export function TripCreateForm() {
  const router = useRouter();
  const [destination, setDestination] = useState("");
  const [durationDays, setDurationDays] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: destination.trim(),
          durationDays: Number(durationDays),
          budgetAmount: Number(budgetAmount),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        id?: string;
        error?: string;
      };
      if (!res.ok || !data.id) {
        setError(data.error ?? "Could not create trip");
        return;
      }
      router.push(`/trips/${data.id}`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
      onSubmit={handleSubmit}
    >
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
        Plan a new trip
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
          placeholder="Lisbon"
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
          placeholder="3"
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
          placeholder="1500"
          value={budgetAmount}
          onChange={(e) => setBudgetAmount(e.target.value)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "Creating…" : "Create trip"}
      </button>
    </form>
  );
}
