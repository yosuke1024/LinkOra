import type { Period } from "../../types.js";

/**
 * HTTP layer for the Wikimedia provider.
 *
 * Terms and constraints are recorded in docs/data-sources/wikimedia-pageviews.md.
 * Per the Wikimedia User-Agent policy, all requests carry an identifying UA.
 * The pageviews API allows far more than our ~91 requests per run, but we
 * throttle and retry conservatively anyway.
 */

export const USER_AGENT = "LinkOra/0.1.0 (https://github.com/yosuke1024/LinkOra; internal data pipeline)";

export interface HttpResponse {
  status: number;
  json: unknown;
}

/** Injectable HTTP function so provider logic is testable offline. */
export type HttpJson = (url: string) => Promise<HttpResponse>;

const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;
const THROTTLE_MS = 150;

let lastRequestAt = 0;

export const defaultHttp: HttpJson = async (url) => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const wait = lastRequestAt + THROTTLE_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    try {
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (RETRY_STATUS.has(res.status) && attempt < MAX_ATTEMPTS) {
        await sleep(1000 * attempt);
        continue;
      }
      const json = res.status === 204 ? null : await res.json().catch(() => null);
      return { status: res.status, json };
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS) await sleep(1000 * attempt);
    }
  }
  throw new Error(`Request failed after ${MAX_ATTEMPTS} attempts: ${url}\n${String(lastError)}`);
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** wbgetentities URL resolving sitelinks for the given items, filtered to the given wikis. */
export function sitelinksUrl(qids: readonly string[], sites: readonly string[]): string {
  const params = new URLSearchParams({
    action: "wbgetentities",
    ids: qids.join("|"),
    props: "sitelinks",
    sitefilter: sites.join("|"),
    format: "json",
    formatversion: "2",
  });
  return `https://www.wikidata.org/w/api.php?${params}`;
}

/**
 * Monthly per-article pageviews URL. `agent=user` excludes bot/spider traffic.
 * Article titles use underscores for spaces and are percent-encoded.
 */
export function pageviewsUrl(edition: string, article: string, period: Period): string {
  const title = encodeURIComponent(article.replaceAll(" ", "_"));
  const { start, end } = monthBounds(period);
  return (
    `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/` +
    `${edition}.wikipedia.org/all-access/user/${title}/monthly/${start}/${end}`
  );
}

/** First and last day of the period month as YYYYMMDDHH stamps. */
export function monthBounds(period: Period): { start: string; end: string } {
  const [year, month] = period.split("-").map(Number) as [number, number];
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const ym = `${year}${String(month).padStart(2, "0")}`;
  return { start: `${ym}0100`, end: `${ym}${String(lastDay).padStart(2, "0")}00` };
}
