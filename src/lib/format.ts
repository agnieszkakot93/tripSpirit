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

export function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return date.toLocaleDateString("en-IE", { month: "short", day: "numeric" });
}

/** Deterministic placeholder image from destination name. */
export function destinationImageUrl(destination: string, width = 800): string {
  const seed = encodeURIComponent(destination.trim().toLowerCase() || "travel");
  return `https://picsum.photos/seed/${seed}/${width}/480`;
}
