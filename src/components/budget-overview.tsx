"use client";

import { formatBudget } from "@/lib/format";
import { dayCost, tripTotalCost } from "@/components/itinerary-view";
import type { Itinerary } from "@/lib/trips/itinerary";

type BudgetOverviewProps = {
  budgetAmount: number;
  itinerary: Itinerary | null;
};

type Category = {
  label: string;
  color: string;
  amount: number;
};

function categorizeItinerary(itinerary: Itinerary): Category[] {
  const activities = itinerary.days.reduce(
    (sum, day) => sum + dayCost(day.activities),
    0,
  );
  const total = tripTotalCost(itinerary);
  const remainder = Math.max(0, total - activities);

  // Without category tags in schema, split remainder into food/transport/other estimates.
  const food = Math.round(remainder * 0.45);
  const transport = Math.round(remainder * 0.3);
  const other = remainder - food - transport;

  return [
    { label: "Activities", color: "#ff7a3d", amount: activities },
    { label: "Food & drinks", color: "#f4a261", amount: food },
    { label: "Transport", color: "#2a9d8f", amount: transport },
    { label: "Other", color: "#8d99ae", amount: other },
  ].filter((c) => c.amount > 0);
}

function DonutChart({ categories, total }: { categories: Category[]; total: number }) {
  if (total <= 0) {
    return (
      <div className="flex h-48 w-48 items-center justify-center rounded-full border-8 border-[var(--border-muted)] bg-[var(--surface-muted)]">
        <span className="text-sm text-[var(--muted)]">No data</span>
      </div>
    );
  }

  const segments = categories.reduce<
    Array<Category & { start: number; end: number }>
  >((acc, cat) => {
    const start = acc.length > 0 ? acc[acc.length - 1].end : 0;
    const end = start + cat.amount / total;
    acc.push({ ...cat, start, end });
    return acc;
  }, []);

  const gradient = segments
    .map(
      (s) =>
        `${s.color} ${(s.start * 360).toFixed(1)}deg ${(s.end * 360).toFixed(1)}deg`,
    )
    .join(", ");

  return (
    <div
      className="relative h-48 w-48 rounded-full"
      style={{
        background: `conic-gradient(${gradient})`,
      }}
    >
      <div className="absolute inset-6 flex flex-col items-center justify-center rounded-full bg-white text-center">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-light)]">
          Estimated
        </span>
        <span className="text-xl font-black text-[var(--foreground)]">
          {formatBudget(total)}
        </span>
      </div>
    </div>
  );
}

export function BudgetOverview({ budgetAmount, itinerary }: BudgetOverviewProps) {
  if (!itinerary || itinerary.days.length === 0) {
    return (
      <div className="rounded-[28px] border border-dashed border-[var(--border)] bg-white p-12 text-center">
        <h3 className="text-lg font-bold text-[var(--foreground)]">
          No budget data yet
        </h3>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Generate an itinerary to see a budget breakdown by category.
        </p>
      </div>
    );
  }

  const total = tripTotalCost(itinerary);
  const remaining = budgetAmount - total;
  const withinBudget = remaining >= 0;
  const categories = categorizeItinerary(itinerary);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-center gap-10 rounded-[28px] border border-[var(--border-muted)] bg-white p-8 shadow-[0_20px_60px_rgba(49,33,20,0.07)]">
        <DonutChart categories={categories} total={total} />

        <div className="grid min-w-[200px] gap-3">
          {categories.map((cat) => (
            <div key={cat.label} className="flex items-center justify-between gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: cat.color }}
                />
                <span className="text-[var(--foreground)]">{cat.label}</span>
              </div>
              <span className="font-semibold text-[var(--foreground)]">
                {formatBudget(cat.amount)}
                <span className="ml-1 font-normal text-[var(--muted-light)]">
                  ({total > 0 ? Math.round((cat.amount / total) * 100) : 0}%)
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Total budget" value={formatBudget(budgetAmount)} />
        <SummaryCard label="Estimated total" value={formatBudget(total)} />
        <SummaryCard
          label="Remaining"
          value={formatBudget(Math.abs(remaining))}
          highlight={withinBudget ? "success" : "warning"}
          prefix={withinBudget ? "" : "Over by "}
        />
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-5 py-4 text-sm text-[var(--muted)]">
        <strong className="text-[var(--foreground)]">Tip:</strong> Adjust activity
        costs in the Itinerary tab to keep your plan within budget. All figures are
        AI estimates.
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  highlight,
  prefix = "",
}: {
  label: string;
  value: string;
  highlight?: "success" | "warning";
  prefix?: string;
}) {
  return (
    <div className="rounded-[22px] border border-[var(--border-muted)] bg-white p-5">
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p
        className={`mt-1 text-2xl font-black tracking-tight ${
          highlight === "success"
            ? "text-green-700"
            : highlight === "warning"
              ? "text-amber-700"
              : "text-[var(--foreground)]"
        }`}
      >
        {prefix}
        {value}
      </p>
    </div>
  );
}
