import { describe, expect, it } from "vitest";

import {
  buildItineraryPrompt,
  buildItinerarySchemaForDuration,
  isItineraryCompleteForDuration,
  type Itinerary,
} from "./itinerary";

/** Literal trip-duration oracle for Risk #3 day-count mismatch cases. */
const TRIP_DURATION_DAYS = 3;

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

describe("buildItinerarySchemaForDuration — Risk #3 day-count mismatch", () => {
  it("rejects itineraries shorter than trip duration", () => {
    const schema = buildItinerarySchemaForDuration(TRIP_DURATION_DAYS);
    expect(
      schema.safeParse(sampleItinerary(TRIP_DURATION_DAYS - 1)).success,
    ).toBe(false);
  });

  it("accepts itineraries with the exact trip duration day count", () => {
    const schema = buildItinerarySchemaForDuration(TRIP_DURATION_DAYS);
    expect(
      schema.safeParse(sampleItinerary(TRIP_DURATION_DAYS)).success,
    ).toBe(true);
  });

  it("rejects itineraries longer than trip duration (over-long day count)", () => {
    const schema = buildItinerarySchemaForDuration(TRIP_DURATION_DAYS);
    expect(
      schema.safeParse(sampleItinerary(TRIP_DURATION_DAYS + 1)).success,
    ).toBe(false);
  });
});

describe("isItineraryCompleteForDuration — Risk #3 day-count mismatch", () => {
  it("returns false when day count is shorter than trip duration", () => {
    expect(
      isItineraryCompleteForDuration(
        sampleItinerary(TRIP_DURATION_DAYS - 1),
        TRIP_DURATION_DAYS,
      ),
    ).toBe(false);
  });

  it("returns false when day count is longer than trip duration (over-long)", () => {
    expect(
      isItineraryCompleteForDuration(
        sampleItinerary(TRIP_DURATION_DAYS + 1),
        TRIP_DURATION_DAYS,
      ),
    ).toBe(false);
  });

  it("returns false when day numbers are not sequential", () => {
    const itinerary = sampleItinerary(TRIP_DURATION_DAYS);
    itinerary.days[1] = { ...itinerary.days[1], day: 5 };
    expect(
      isItineraryCompleteForDuration(itinerary, TRIP_DURATION_DAYS),
    ).toBe(false);
  });

  it("returns true when day count matches trip duration and days are sequential", () => {
    expect(
      isItineraryCompleteForDuration(
        sampleItinerary(TRIP_DURATION_DAYS),
        TRIP_DURATION_DAYS,
      ),
    ).toBe(true);
  });
});
