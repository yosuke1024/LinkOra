import type { CountryCode, Period, RawRef, SignalKind, SignalRecord } from "../types.js";
import type { Storage } from "../storage/types.js";

/**
 * Common provider interface (docs/IMPLEMENTATION_PLAN.md §5).
 *
 * Contract:
 * - `fetch` writes raw data to the `raw` storage layer and returns refs to it.
 *   It must be safe to re-run for the same period (idempotent overwrite).
 * - `normalize` reads raw data via the refs and emits SignalRecords with
 *   `value` normalized to [0, 1] **within this provider**. It must be a pure
 *   transformation of the raw data (deterministic, no further network calls)
 *   so that any period can be recomputed from stored raw data alone.
 */
export interface Provider {
  /** Stable id, also used as the raw-layer key prefix (e.g. "wikimedia-pageviews"). */
  id: string;
  signal: SignalKind;
  fetch(period: Period, countries: readonly CountryCode[], storage: Storage): Promise<RawRef[]>;
  normalize(raw: RawRef[], storage: Storage): Promise<SignalRecord[]>;
}
