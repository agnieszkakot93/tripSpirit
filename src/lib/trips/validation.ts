type ValidBody = {
  ok: true;
  values: { destination: string; durationDays: number; budgetAmount: number };
};
type InvalidBody = { ok: false; error: string };

export function validateTripBody(body: unknown): ValidBody | InvalidBody {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Request body must be a JSON object" };
  }

  const raw = body as Record<string, unknown>;

  const destination =
    typeof raw.destination === "string" ? raw.destination.trim() : null;
  if (!destination || destination.length < 1 || destination.length > 120) {
    return {
      ok: false,
      error: "destination must be a string between 1 and 120 characters",
    };
  }

  const durationDays = raw.durationDays;
  if (
    typeof durationDays !== "number" ||
    !Number.isInteger(durationDays) ||
    durationDays < 1 ||
    durationDays > 14
  ) {
    return {
      ok: false,
      error: "durationDays must be an integer between 1 and 14",
    };
  }

  const budgetAmount = raw.budgetAmount;
  if (
    typeof budgetAmount !== "number" ||
    !Number.isInteger(budgetAmount) ||
    budgetAmount < 1 ||
    budgetAmount > 50000
  ) {
    return {
      ok: false,
      error: "budgetAmount must be an integer between 1 and 50000",
    };
  }

  return { ok: true, values: { destination, durationDays, budgetAmount } };
}
