import { countryByCode } from "../../../config/countries.js";
import type { CountryCode, Period, RawRef, SignalRecord } from "../../types.js";
import type { Storage } from "../../storage/types.js";
import { getJson, putJson } from "../../storage/types.js";
import type { Provider } from "../types.js";
import { defaultHttp, pageviewsUrl, sitelinksUrl, type HttpJson } from "./api.js";
import type { RawAudiencePageviews, RawSitelinks } from "./types.js";

export const WIKIMEDIA_PROVIDER_ID = "wikimedia-pageviews";

/**
 * Wave 1 knowledge signal (docs/data-sources/wikimedia-pageviews.md).
 *
 * Audience proxy: each audience country is represented by its Wikipedia
 * language edition (config/countries.ts `wikipedia`). Interest from A to B is
 * measured as monthly user pageviews of B's country article in A's edition,
 * normalized within the audience to [0, 1] (division by the audience max).
 *
 * Known limitation, recorded in the data-source review: editions shared
 * across audiences (en for SG and US) cannot separate those audiences, and
 * hi understates English-language usage in IN. Kept for M2; revisit with
 * reader-country data at M5.
 */
export class WikimediaPageviewsProvider implements Provider {
  readonly id = WIKIMEDIA_PROVIDER_ID;
  readonly signal = "knowledge" as const;

  constructor(private readonly http: HttpJson = defaultHttp) {}

  async fetch(
    period: Period,
    countries: readonly CountryCode[],
    storage: Storage,
  ): Promise<RawRef[]> {
    const configs = countries.map(countryByCode);
    const sites = [...new Set(configs.map((c) => `${c.wikipedia}wiki`))];
    const qids = configs.map((c) => c.wikidata);

    const sitelinks = await this.fetchSitelinks(period, qids, sites);
    const sitelinksKey = `${this.id}/${period}/sitelinks.json`;
    await putJson(storage, "raw", sitelinksKey, sitelinks);

    const refs: RawRef[] = [{ provider: this.id, period, key: sitelinksKey }];
    for (const audience of configs) {
      const raw: RawAudiencePageviews = {
        provider: this.id,
        period,
        audience: audience.code,
        edition: audience.wikipedia,
        fetchedAt: new Date().toISOString(),
        entries: [],
      };
      for (const target of configs) {
        if (target.code === audience.code) continue;
        const article = sitelinks.titles[target.wikidata]?.[`${audience.wikipedia}wiki`] ?? null;
        if (article === null) {
          console.warn(
            `wikimedia: no ${audience.wikipedia}wiki article for ${target.code} — edge ${audience.code}->${target.code} skipped`,
          );
          raw.entries.push({ target: target.code, article: null, views: null });
          continue;
        }
        const views = await this.fetchMonthlyViews(audience.wikipedia, article, period);
        raw.entries.push({ target: target.code, article, views });
      }
      const key = `${this.id}/${period}/${audience.code}.json`;
      await putJson(storage, "raw", key, raw);
      refs.push({ provider: this.id, period, key });
    }
    return refs;
  }

  async normalize(raw: RawRef[], storage: Storage): Promise<SignalRecord[]> {
    const records: SignalRecord[] = [];
    for (const ref of raw) {
      if (ref.key.endsWith("/sitelinks.json")) continue;
      const audience = await getJson<RawAudiencePageviews>(storage, "raw", ref.key);
      if (audience === null) {
        throw new Error(`wikimedia: missing raw object ${ref.key} — re-run fetch for ${ref.period}`);
      }
      records.push(...normalizeAudience(audience, ref.key));
    }
    return records;
  }

  private async fetchSitelinks(
    period: Period,
    qids: readonly string[],
    sites: readonly string[],
  ): Promise<RawSitelinks> {
    const res = await this.http(sitelinksUrl(qids, sites));
    if (res.status !== 200) {
      throw new Error(`wikimedia: wbgetentities returned HTTP ${res.status}`);
    }
    const body = res.json as {
      entities?: Record<string, { sitelinks?: Record<string, { title: string }> }>;
    };
    if (!body.entities) {
      throw new Error("wikimedia: wbgetentities response has no entities");
    }
    const titles: Record<string, Record<string, string>> = {};
    for (const [qid, entity] of Object.entries(body.entities)) {
      titles[qid] = {};
      for (const [site, link] of Object.entries(entity.sitelinks ?? {})) {
        titles[qid]![site] = link.title;
      }
    }
    return { provider: this.id, period, fetchedAt: new Date().toISOString(), titles };
  }

  private async fetchMonthlyViews(
    edition: string,
    article: string,
    period: Period,
  ): Promise<number | null> {
    const res = await this.http(pageviewsUrl(edition, article, period));
    if (res.status === 404) return null; // no data for this article/month
    if (res.status !== 200) {
      throw new Error(
        `wikimedia: pageviews returned HTTP ${res.status} for ${edition}:${article} ${period}`,
      );
    }
    const body = res.json as { items?: Array<{ views: number }> };
    if (!body.items || body.items.length === 0) return null;
    return body.items.reduce((sum, item) => sum + item.views, 0);
  }
}

/**
 * Pure normalization for one audience: divide by the audience's max views.
 * Entries without data (missing article or 404) produce no record, so the
 * edge's confidence reflects the gap instead of a fabricated zero.
 */
export function normalizeAudience(
  raw: RawAudiencePageviews,
  rawRef: string,
): SignalRecord[] {
  const withViews = raw.entries.filter(
    (e): e is typeof e & { views: number } => e.views !== null,
  );
  const max = Math.max(0, ...withViews.map((e) => e.views));
  if (max === 0) return [];
  return withViews.map((entry) => ({
    source: raw.audience,
    target: entry.target,
    signal: "knowledge" as const,
    provider: raw.provider,
    topic: null,
    value: entry.views / max,
    rawRef,
    period: raw.period,
    observedAt: raw.fetchedAt,
  }));
}
