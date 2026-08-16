import type { CountryCode } from "../src/types.js";

/**
 * Initial MVP scope: 10 countries, at most 90 directed edges.
 * Do not widen this list before Phase 1 validation (see docs/IMPLEMENTATION_PLAN.md §1).
 */
export interface CountryConfig {
  code: CountryCode;
  name: string;
  /** Primary language (BCP 47), used later for information-supply estimation. */
  language: string;
  /** Wikipedia language edition most representative of the audience. */
  wikipedia: string;
}

export const COUNTRIES: readonly CountryConfig[] = [
  { code: "JP", name: "Japan", language: "ja", wikipedia: "ja" },
  { code: "TH", name: "Thailand", language: "th", wikipedia: "th" },
  { code: "IN", name: "India", language: "hi", wikipedia: "hi" },
  { code: "KR", name: "South Korea", language: "ko", wikipedia: "ko" },
  { code: "ID", name: "Indonesia", language: "id", wikipedia: "id" },
  { code: "VN", name: "Vietnam", language: "vi", wikipedia: "vi" },
  { code: "SG", name: "Singapore", language: "en", wikipedia: "en" },
  { code: "FR", name: "France", language: "fr", wikipedia: "fr" },
  { code: "DE", name: "Germany", language: "de", wikipedia: "de" },
  { code: "US", name: "United States", language: "en", wikipedia: "en" },
] as const;

export const COUNTRY_CODES: readonly CountryCode[] = COUNTRIES.map((c) => c.code);

/** All directed source -> target pairs (source !== target). */
export function directedEdges(
  codes: readonly CountryCode[] = COUNTRY_CODES,
): Array<{ source: CountryCode; target: CountryCode }> {
  const edges: Array<{ source: CountryCode; target: CountryCode }> = [];
  for (const source of codes) {
    for (const target of codes) {
      if (source !== target) edges.push({ source, target });
    }
  }
  return edges;
}
