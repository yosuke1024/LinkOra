/**
 * Core data model for LinkOra.
 *
 * See docs/IMPLEMENTATION_PLAN.md §3. The schemas here mirror the planning
 * issue (pixapps_strategy#25): composite scores are never published without
 * the underlying per-signal values.
 */

/** ISO 3166-1 alpha-2 country code (e.g. "JP", "TH"). */
export type CountryCode = string;

/** Observation period, monthly granularity: "YYYY-MM". */
export type Period = string;

export const SIGNAL_KINDS = [
  "search",
  "knowledge",
  "travel",
  "structural",
  "supply",
] as const;

export type SignalKind = (typeof SIGNAL_KINDS)[number];

/** Confidence is derived mechanically from signal coverage, never assigned by hand. */
export type Confidence = "low" | "medium" | "high";

/**
 * Reference to raw data persisted in the `raw` storage layer.
 * Raw data is always stored before any derived score is computed, so that
 * every period can be recomputed when the scoring version changes.
 */
export interface RawRef {
  provider: string;
  period: Period;
  /** Key within the `raw` layer, e.g. "wikimedia-pageviews/2026-08/TH.json". */
  key: string;
}

/**
 * Normalized signal record — the common output format all providers emit
 * from Stage 2 (normalize). `value` is relative within the provider, [0, 1].
 */
export interface SignalRecord {
  source: CountryCode;
  target: CountryCode;
  signal: SignalKind;
  provider: string;
  /** Topic id from config/topics.ts, or null for the country-level signal. */
  topic: string | null;
  value: number;
  rawRef: string;
  period: Period;
  observedAt: string;
}

export interface TopicScore {
  topic: string;
  score: number;
}

/**
 * Edge record — the published unit (Stage 3 output). One record per directed
 * country pair per period.
 */
export interface EdgeRecord {
  source: CountryCode;
  target: CountryCode;
  interestScore: number;
  informationSupply: number | null;
  informationGap: number | null;
  trend12m: number | null;
  signals: Partial<Record<SignalKind, number>>;
  topics: TopicScore[];
  confidence: Confidence;
  scoringVersion: string;
  period: Period;
  observedAt: string;
}
