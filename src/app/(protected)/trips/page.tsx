export default function TripsPage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center p-12 text-center">
      <div className="max-w-md rounded-[32px] border border-dashed border-[var(--border)] bg-white px-10 py-16">
        <h1 className="text-2xl font-black tracking-tight text-[var(--foreground)]">
          Select or create a trip
        </h1>
        <p className="mt-3 text-[var(--muted)]">
          Your AI-generated city-break itinerary will appear here. Pick a trip
          from the list or create a new one.
        </p>
      </div>
    </div>
  );
}
