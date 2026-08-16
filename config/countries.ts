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
  /** Wikidata item for the country, used to resolve article titles per edition. */
  wikidata: string;
}

export const COUNTRIES: readonly CountryConfig[] = [
  { code: "JP", name: "Japan", language: "ja", wikipedia: "ja", wikidata: "Q17" },
  { code: "TH", name: "Thailand", language: "th", wikipedia: "th", wikidata: "Q869" },
  { code: "IN", name: "India", language: "hi", wikipedia: "hi", wikidata: "Q668" },
  { code: "KR", name: "South Korea", language: "ko", wikipedia: "ko", wikidata: "Q884" },
  { code: "ID", name: "Indonesia", language: "id", wikipedia: "id", wikidata: "Q252" },
  { code: "VN", name: "Vietnam", language: "vi", wikipedia: "vi", wikidata: "Q881" },
  { code: "SG", name: "Singapore", language: "en", wikipedia: "en", wikidata: "Q334" },
  { code: "FR", name: "France", language: "fr", wikipedia: "fr", wikidata: "Q142" },
  { code: "DE", name: "Germany", language: "de", wikipedia: "de", wikidata: "Q183" },
  { code: "US", name: "United States", language: "en", wikipedia: "en", wikidata: "Q30" },
] as const;

export function countryByCode(code: CountryCode): CountryConfig {
  const country = COUNTRIES.find((c) => c.code === code);
  if (!country) throw new Error(`Unknown country code "${code}"`);
  return country;
}

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
