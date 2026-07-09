import { describe, expect, it } from "vitest";

import {
  buildItineraryPrompt,
  buildItinerarySchemaForDuration,
  isItineraryCompleteForDuration,
  type Itinerary,
} from "./itinerary";

function sampleItinerary(dayCount: number): Itinerary {
  return {
    days: Array.from({ length: dayCount }, (_, i) => ({
      day: i + 1,
      title: `Day ${i + 1}`,
      activities: [
        {
          name: "Activity",
          description: "Description",
          approxCostEur: 10,
        },
      ],
    })),
    totalApproxCostEur: dayCount * 10,
  };
}

describe("buildItineraryPrompt", () => {
  it("requires exactly the requested number of days", () => {
    const prompt = buildItineraryPrompt({
      destination: "Athens",
      durationDays: 10,
      budgetAmount: 5000,
    });
    expect(prompt).toContain("10-day");
    expect(prompt).toContain("exactly 10 days");
    expect(prompt).toContain("numbered 1 through 10");
  });
});

describe("buildItinerarySchemaForDuration", () => {
  it("rejects itineraries with fewer days than requested", () => {
    const schema = buildItinerarySchemaForDuration(10);
    expect(schema.safeParse(sampleItinerary(1)).success).toBe(false);
  });

  it("accepts itineraries with the exact day count", () => {
    const schema = buildItinerarySchemaForDuration(3);
    expect(schema.safeParse(sampleItinerary(3)).success).toBe(true);
  });
});

describe("isItineraryCompleteForDuration", () => {
  it("returns false when day count does not match", () => {
    expect(isItineraryCompleteForDuration(sampleItinerary(1), 10)).toBe(false);
  });

  it("returns false when day numbers are not sequential", () => {
    const itinerary = sampleItinerary(3);
    itinerary.days[1] = { ...itinerary.days[1], day: 5 };
    expect(isItineraryCompleteForDuration(itinerary, 3)).toBe(false);
  });

  it("returns true for a complete itinerary", () => {
    expect(isItineraryCompleteForDuration(sampleItinerary(10), 10)).toBe(true);
  });
});
