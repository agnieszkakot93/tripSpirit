import { describe, expect, it } from "vitest";

import { validateTripBody } from "./validation";

describe("validateTripBody", () => {
  describe("valid bodies", () => {
    it("accepts minimal valid input", () => {
      const result = validateTripBody({
        destination: "Lisbon",
        durationDays: 1,
        budgetAmount: 1,
      });
      expect(result).toEqual({
        ok: true,
        values: { destination: "Lisbon", durationDays: 1, budgetAmount: 1 },
      });
    });

    it("accepts maximum valid values", () => {
      const result = validateTripBody({
        destination: "A".repeat(120),
        durationDays: 14,
        budgetAmount: 50000,
      });
      expect(result).toMatchObject({ ok: true });
    });

    it("trims destination whitespace", () => {
      const result = validateTripBody({
        destination: "  Paris  ",
        durationDays: 3,
        budgetAmount: 1000,
      });
      expect(result).toEqual({
        ok: true,
        values: { destination: "Paris", durationDays: 3, budgetAmount: 1000 },
      });
    });
  });

  describe("invalid body shape", () => {
    it("rejects null", () => {
      const result = validateTripBody(null);
      expect(result.ok).toBe(false);
    });

    it("rejects a string", () => {
      const result = validateTripBody("not an object");
      expect(result.ok).toBe(false);
    });

    it("rejects an array", () => {
      const result = validateTripBody([]);
      expect(result.ok).toBe(false);
    });
  });

  describe("destination validation", () => {
    it("rejects empty string", () => {
      const result = validateTripBody({
        destination: "",
        durationDays: 3,
        budgetAmount: 500,
      });
      expect(result.ok).toBe(false);
    });

    it("rejects whitespace-only string", () => {
      const result = validateTripBody({
        destination: "   ",
        durationDays: 3,
        budgetAmount: 500,
      });
      expect(result.ok).toBe(false);
    });

    it("rejects destination exceeding 120 characters", () => {
      const result = validateTripBody({
        destination: "A".repeat(121),
        durationDays: 3,
        budgetAmount: 500,
      });
      expect(result.ok).toBe(false);
    });

    it("rejects non-string destination", () => {
      const result = validateTripBody({
        destination: 42,
        durationDays: 3,
        budgetAmount: 500,
      });
      expect(result.ok).toBe(false);
    });
  });

  describe("durationDays validation", () => {
    it("rejects 0", () => {
      expect(
        validateTripBody({ destination: "Tokyo", durationDays: 0, budgetAmount: 500 }).ok,
      ).toBe(false);
    });

    it("rejects 15 (over max)", () => {
      expect(
        validateTripBody({ destination: "Tokyo", durationDays: 15, budgetAmount: 500 }).ok,
      ).toBe(false);
    });

    it("rejects a float", () => {
      expect(
        validateTripBody({ destination: "Tokyo", durationDays: 1.5, budgetAmount: 500 }).ok,
      ).toBe(false);
    });

    it("rejects a string number", () => {
      expect(
        validateTripBody({ destination: "Tokyo", durationDays: "7", budgetAmount: 500 }).ok,
      ).toBe(false);
    });

    it("accepts boundary values 1 and 14", () => {
      expect(
        validateTripBody({ destination: "Tokyo", durationDays: 1, budgetAmount: 500 }).ok,
      ).toBe(true);
      expect(
        validateTripBody({ destination: "Tokyo", durationDays: 14, budgetAmount: 500 }).ok,
      ).toBe(true);
    });
  });

  describe("budgetAmount validation", () => {
    it("rejects 0", () => {
      expect(
        validateTripBody({ destination: "Tokyo", durationDays: 7, budgetAmount: 0 }).ok,
      ).toBe(false);
    });

    it("rejects 50001 (over max)", () => {
      expect(
        validateTripBody({ destination: "Tokyo", durationDays: 7, budgetAmount: 50001 }).ok,
      ).toBe(false);
    });

    it("rejects a float", () => {
      expect(
        validateTripBody({ destination: "Tokyo", durationDays: 7, budgetAmount: 99.9 }).ok,
      ).toBe(false);
    });

    it("accepts boundary values 1 and 50000", () => {
      expect(
        validateTripBody({ destination: "Tokyo", durationDays: 7, budgetAmount: 1 }).ok,
      ).toBe(true);
      expect(
        validateTripBody({ destination: "Tokyo", durationDays: 7, budgetAmount: 50000 }).ok,
      ).toBe(true);
    });
  });
});
