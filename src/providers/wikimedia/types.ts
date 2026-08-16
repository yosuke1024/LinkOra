import type { CountryCode, Period } from "../../types.js";

/** Raw sitelink resolution, stored at wikimedia-pageviews/<period>/sitelinks.json. */
export interface RawSitelinks {
  provider: string;
  period: Period;
  fetchedAt: string;
  /** QID -> wiki site id (e.g. "thwiki") -> article title. */
  titles: Record<string, Record<string, string>>;
}

export interface RawPageviewEntry {
  target: CountryCode;
  /** Resolved article title, or null when the edition has no article for the target. */
  article: string | null;
  /** Monthly user pageviews, or null when the API had no data (404). */
  views: number | null;
}

/** Raw per-audience pageviews, stored at wikimedia-pageviews/<period>/<audience>.json. */
export interface RawAudiencePageviews {
  provider: string;
  period: Period;
  audience: CountryCode;
  /** Wikipedia edition used as the audience proxy, e.g. "th". */
  edition: string;
  fetchedAt: string;
  entries: RawPageviewEntry[];
}
