import type { Period } from "./types.js";

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidPeriod(value: string): value is Period {
  return PERIOD_RE.test(value);
}

export function assertPeriod(value: string): Period {
  if (!isValidPeriod(value)) {
    throw new Error(`Invalid period "${value}" — expected YYYY-MM (e.g. 2026-08)`);
  }
  return value;
}

/**
 * The default period for a run is the previous full month: the pipeline runs
 * weekly, but signals are aggregated monthly and a month is only complete
 * once it has ended.
 */
export function previousMonth(now: Date = new Date()): Period {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-based; equals previous 1-based month
  if (month === 0) return `${year - 1}-12`;
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** The `count` periods ending at `end` (inclusive), oldest first. Used for trend windows. */
export function periodRange(end: Period, count: number): Period[] {
  assertPeriod(end);
  const [endYear, endMonth] = end.split("-").map(Number) as [number, number];
  const periods: Period[] = [];
  let year = endYear;
  let month = endMonth;
  for (let i = 0; i < count; i++) {
    periods.push(`${year}-${String(month).padStart(2, "0")}`);
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  return periods.reverse();
}
