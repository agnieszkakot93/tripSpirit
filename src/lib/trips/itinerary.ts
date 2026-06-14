import { z } from "zod";

/**
 * Single source of truth for the AI structured-output contract, the persisted
 * `trips.itinerary_json` shape, and the UI type. Field names are the streaming
 * wire contract — keep them stable (server `streamObject` and client
 * `useObject` both bind to this schema).
 *
 * Per-day cost is derived in the UI (sum of a day's activity costs), not a
 * model field. Costs are AI estimates in whole EUR.
 */
export const itineraryActivitySchema = z.object({
  name: z.string().describe("Short activity name, e.g. 'Belém Tower'"),
  description: z
    .string()
    .describe("One or two sentences describing the activity"),
  approxCostEur: z
    .number()
    .describe("Approximate cost per person in whole EUR (0 if free)"),
});

export const itineraryDaySchema = z.object({
  day: z.number().describe("1-based day number"),
  title: z.string().describe("Short theme for the day, e.g. 'Historic centre'"),
  activities: z.array(itineraryActivitySchema),
});

export const itinerarySchema = z.object({
  days: z.array(itineraryDaySchema),
  totalApproxCostEur: z
    .number()
    .describe("Approximate total cost for the whole trip in whole EUR"),
});

export type ItineraryActivity = z.infer<typeof itineraryActivitySchema>;
export type ItineraryDay = z.infer<typeof itineraryDaySchema>;
export type Itinerary = z.infer<typeof itinerarySchema>;

/**
 * Build the generation prompt from a trip. The budget is a planning guideline,
 * NOT a hard cap (PRD business logic). Output shape is enforced by
 * `itinerarySchema`, so it is not restated in prose here.
 */
export function buildItineraryPrompt(input: {
  destination: string;
  durationDays: number;
  budgetAmount: number;
}): string {
  const { destination, durationDays, budgetAmount } = input;
  return [
    `Plan a ${durationDays}-day city-break itinerary for ${destination}.`,
    `Aim to keep the trip roughly within a budget of about €${budgetAmount} as a planning guideline — not a strict limit; sensible suggestions that modestly exceed it are fine.`,
    `For each day, provide a short thematic title and 2 to 4 activities. Each activity needs a brief description and an approximate per-person cost in whole euros (use 0 for free activities).`,
    `Vary the activities across the days and order them sensibly within each day. Provide an approximate total cost for the whole trip.`,
    `All costs are rough AI estimates.`,
  ].join(" ");
}
