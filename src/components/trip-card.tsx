import Link from "next/link";

// Persisted budget is a whole EUR integer (see budget_amount in schema).
const eurFormatter = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function formatBudget(budgetAmount: number): string {
  return eurFormatter.format(budgetAmount);
}

export function formatDuration(durationDays: number): string {
  return `${durationDays} ${durationDays === 1 ? "day" : "days"}`;
}

export function TripCard({
  id,
  destination,
  durationDays,
  budgetAmount,
}: {
  id: string;
  destination: string;
  durationDays: number;
  budgetAmount: number;
}) {
  return (
    <Link
      href={`/trips/${id}`}
      className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-white px-4 py-3 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
    >
      <span className="font-medium text-zinc-900 dark:text-zinc-50">
        {destination}
      </span>
      <span className="text-sm text-zinc-600 dark:text-zinc-400">
        {formatDuration(durationDays)} · {formatBudget(budgetAmount)}
      </span>
    </Link>
  );
}
