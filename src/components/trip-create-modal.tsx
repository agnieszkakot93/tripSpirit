"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { PlusIcon } from "@/components/icons";
import { LoaderInline } from "@/components/loader";

type TripCreateModalProps = {
  open: boolean;
  onClose: () => void;
};

export function TripCreateModal({ open, onClose }: TripCreateModalProps) {
  const router = useRouter();
  const [destination, setDestination] = useState("");
  const [durationDays, setDurationDays] = useState("3");
  const [budgetAmount, setBudgetAmount] = useState("500");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!open) return null;

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
      setDestination("");
      setDurationDays("3");
      setBudgetAmount("500");
      onClose();
      router.push(`/trips/${data.id}`);
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-trip-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[32px] bg-[var(--surface)] p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="create-trip-title"
          className="text-2xl font-black tracking-tight text-[var(--foreground)]"
        >
          Create a trip
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          AI will generate a day-by-day itinerary with activities and estimated
          costs.
        </p>

        {error ? (
          <p className="alert-error mt-4" role="alert">
            {error}
          </p>
        ) : null}

        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-1.5 text-sm">
            <span className="font-semibold text-[var(--foreground)]">
              Destination
            </span>
            <input
              type="text"
              required
              maxLength={120}
              placeholder="Rome, Italy"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="field-input"
              autoFocus
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold text-[var(--foreground)]">
                Duration
              </span>
              <select
                required
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                className="field-input"
              >
                {Array.from({ length: 14 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d} {d === 1 ? "day" : "days"}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold text-[var(--foreground)]">
                Budget
              </span>
              <select
                required
                value={budgetAmount}
                onChange={(e) => setBudgetAmount(e.target.value)}
                className="field-input"
              >
                {[300, 500, 600, 800, 1000, 1500, 2000, 3000, 5000].map(
                  (b) => (
                    <option key={b} value={b}>
                      €{b}
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--muted)]">
            <PlusIcon className="mb-1 inline text-[var(--primary)]" /> After
            creating, open the trip and tap{" "}
            <strong className="text-[var(--foreground)]">
              Generate itinerary
            </strong>{" "}
            to build your plan.
          </div>

          <div className="mt-2 flex gap-3">
            <button
              type="button"
              className="btn-ghost flex-1 rounded-full py-3 text-sm font-semibold text-[var(--foreground)]"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="btn-primary flex-1"
            >
              {pending ? <LoaderInline label="Creating…" /> : "Create trip"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
