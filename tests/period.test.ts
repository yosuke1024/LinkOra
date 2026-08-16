import { describe, expect, it } from "vitest";
import { assertPeriod, isValidPeriod, periodRange, previousMonth } from "../src/period.js";

describe("period", () => {
  it("validates YYYY-MM", () => {
    expect(isValidPeriod("2026-08")).toBe(true);
    expect(isValidPeriod("2026-12")).toBe(true);
    expect(isValidPeriod("2026-13")).toBe(false);
    expect(isValidPeriod("2026-00")).toBe(false);
    expect(isValidPeriod("2026-8")).toBe(false);
    expect(isValidPeriod("2026-08-01")).toBe(false);
    expect(() => assertPeriod("bogus")).toThrow(/Invalid period/);
  });

  it("defaults to the previous full month (UTC)", () => {
    expect(previousMonth(new Date("2026-08-16T00:00:00Z"))).toBe("2026-07");
    expect(previousMonth(new Date("2026-01-05T00:00:00Z"))).toBe("2025-12");
  });

  it("builds trend windows across year boundaries, oldest first", () => {
    expect(periodRange("2026-02", 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(periodRange("2026-08", 1)).toEqual(["2026-08"]);
  });
});
