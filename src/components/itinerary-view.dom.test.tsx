/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DISCLAIMER, ItineraryView } from "./itinerary-view";

const sampleItinerary = {
  days: [
    {
      day: 1,
      title: "Historic centre",
      activities: [
        {
          name: "Belém Tower",
          description: "Iconic landmark",
          approxCostEur: 8,
        },
        { name: "Pastéis", description: "Pastry stop", approxCostEur: 5 },
      ],
    },
  ],
  totalApproxCostEur: 13,
};

describe("ItineraryView — FR-010 DOM", () => {
  it("renders the PRD disclaimer in the document", () => {
    render(<ItineraryView itinerary={sampleItinerary} />);
    expect(screen.getByText(DISCLAIMER)).toBeInTheDocument();
  });

  it("renders day activities, derived day cost, and AI estimated total", () => {
    render(<ItineraryView itinerary={sampleItinerary} />);

    expect(
      screen.getByRole("heading", { name: /Day 1: Historic centre/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Belém Tower")).toBeInTheDocument();
    expect(screen.getByText(/Estimated total: €13/)).toBeInTheDocument();
  });

  it("omits estimated total when totalApproxCostEur is absent but keeps disclaimer", () => {
    const { totalApproxCostEur: _total, ...withoutTotal } = sampleItinerary;
    render(<ItineraryView itinerary={withoutTotal} />);

    expect(screen.queryByText(/Estimated total:/i)).not.toBeInTheDocument();
    expect(screen.getByText(DISCLAIMER)).toBeInTheDocument();
  });
});
