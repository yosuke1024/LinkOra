import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalStorage } from "../src/storage/local.js";
import { getJson } from "../src/storage/types.js";
import { monthBounds, pageviewsUrl, sitelinksUrl, type HttpJson } from "../src/providers/wikimedia/api.js";
import {
  WikimediaPageviewsProvider,
  normalizeAudience,
} from "../src/providers/wikimedia/index.js";
import type { RawAudiencePageviews } from "../src/providers/wikimedia/types.js";
import { runFetch } from "../src/pipeline/fetch.js";
import { runNormalize } from "../src/pipeline/normalize.js";
import { runScore } from "../src/pipeline/score.js";
import { runExport } from "../src/pipeline/export.js";
import type { EdgeRecord } from "../src/types.js";

const PERIOD = "2026-07";

describe("wikimedia api helpers", () => {
  it("computes month bounds, including leap years", () => {
    expect(monthBounds("2026-07")).toEqual({ start: "2026070100", end: "2026073100" });
    expect(monthBounds("2026-02")).toEqual({ start: "2026020100", end: "2026022800" });
    expect(monthBounds("2028-02")).toEqual({ start: "2028020100", end: "2028022900" });
  });

  it("builds pageviews URLs with underscores and percent-encoding", () => {
    const url = pageviewsUrl("en", "South Korea", "2026-07");
    expect(url).toBe(
      "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/" +
        "en.wikipedia.org/all-access/user/South_Korea/monthly/2026070100/2026073100",
    );
    expect(pageviewsUrl("th", "ประเทศญี่ปุ่น", "2026-07")).toContain(
      encodeURIComponent("ประเทศญี่ปุ่น"),
    );
  });

  it("builds a wbgetentities URL with site filters", () => {
    const url = sitelinksUrl(["Q17", "Q869"], ["thwiki", "jawiki"]);
    expect(url).toContain("www.wikidata.org");
    expect(url).toContain("ids=Q17%7CQ869");
    expect(url).toContain("sitefilter=thwiki%7Cjawiki");
  });
});

describe("normalizeAudience", () => {
  const base: RawAudiencePageviews = {
    provider: "wikimedia-pageviews",
    period: PERIOD,
    audience: "TH",
    edition: "th",
    fetchedAt: "2026-08-16T00:00:00.000Z",
    entries: [
      { target: "JP", article: "ประเทศญี่ปุ่น", views: 100000 },
      { target: "KR", article: "ประเทศเกาหลีใต้", views: 50000 },
      { target: "US", article: "สหรัฐ", views: 25000 },
      { target: "DE", article: null, views: null },
    ],
  };

  it("normalizes by the audience max and carries provenance", () => {
    const records = normalizeAudience(base, "wikimedia-pageviews/2026-07/TH.json");
    expect(records).toHaveLength(3); // null-view entry produces no record
    const jp = records.find((r) => r.target === "JP")!;
    expect(jp.value).toBe(1);
    expect(jp.source).toBe("TH");
    expect(jp.signal).toBe("knowledge");
    expect(jp.rawRef).toBe("wikimedia-pageviews/2026-07/TH.json");
    expect(jp.observedAt).toBe(base.fetchedAt);
    expect(records.find((r) => r.target === "KR")!.value).toBe(0.5);
    expect(records.find((r) => r.target === "US")!.value).toBe(0.25);
  });

  it("is pure: same input, same output", () => {
    expect(normalizeAudience(base, "x")).toEqual(normalizeAudience(base, "x"));
  });

  it("returns nothing when the audience has no usable views", () => {
    const empty: RawAudiencePageviews = {
      ...base,
      entries: [{ target: "JP", article: "x", views: null }],
    };
    expect(normalizeAudience(empty, "x")).toEqual([]);
  });
});

/**
 * Fake Wikimedia backend: 3 countries (TH, JP, KR), deterministic view counts.
 */
function fakeHttp(): { http: HttpJson; requests: string[] } {
  const requests: string[] = [];
  const views: Record<string, number> = {
    "th:ญี่ปุ่น": 90000,
    "th:เกาหลีใต้": 45000,
    "ja:タイ王国": 60000,
    "ja:大韓民国": 80000,
    "ko:태국": 30000,
    // ko:일본 intentionally missing -> 404 -> null views
  };
  const titles: Record<string, Record<string, string>> = {
    Q17: { thwiki: "ญี่ปุ่น", kowiki: "일본" },
    Q869: { jawiki: "タイ王国", kowiki: "태국" },
    Q884: { thwiki: "เกาหลีใต้", jawiki: "大韓民国" },
  };
  const http: HttpJson = (url) => {
    requests.push(url);
    if (url.includes("wikidata.org")) {
      const entities = Object.fromEntries(
        Object.entries(titles).map(([qid, links]) => [
          qid,
          {
            sitelinks: Object.fromEntries(
              Object.entries(links).map(([site, title]) => [site, { title }]),
            ),
          },
        ]),
      );
      return Promise.resolve({ status: 200, json: { entities } });
    }
    const match = url.match(/per-article\/(\w+)\.wikipedia\.org\/all-access\/user\/([^/]+)\//);
    const edition = match![1]!;
    const article = decodeURIComponent(match![2]!);
    const count = views[`${edition}:${article}`];
    if (count === undefined) return Promise.resolve({ status: 404, json: null });
    return Promise.resolve({ status: 200, json: { items: [{ views: count }] } });
  };
  return { http, requests };
}

describe("wikimedia provider end-to-end (fixture-backed)", () => {
  let root: string;
  let storage: LocalStorage;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "linkora-wikimedia-"));
    storage = new LocalStorage(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("runs fetch -> normalize -> score -> export and publishes edges", async () => {
    const { http } = fakeHttp();
    const provider = new WikimediaPageviewsProvider(http);
    const countries = ["TH", "JP", "KR"];
    // Same provider, scoped to the 3 fixture countries instead of all 10.
    const scoped = {
      id: provider.id,
      signal: provider.signal,
      fetch: (p: string, _all: readonly string[], s: LocalStorage) =>
        provider.fetch(p, countries, s),
      normalize: provider.normalize.bind(provider),
    };

    const refs = await runFetch(PERIOD, storage, [scoped]);
    // sitelinks + one raw file per audience
    expect(refs.map((r) => r.key)).toEqual([
      "wikimedia-pageviews/2026-07/sitelinks.json",
      "wikimedia-pageviews/2026-07/TH.json",
      "wikimedia-pageviews/2026-07/JP.json",
      "wikimedia-pageviews/2026-07/KR.json",
    ]);

    const records = await runNormalize(PERIOD, storage, [provider]);
    // TH: JP+KR, JP: TH+KR, KR: TH only (JP article 404s)
    expect(records).toHaveLength(5);
    const thJp = records.find((r) => r.source === "TH" && r.target === "JP")!;
    expect(thJp.value).toBe(1);
    expect(records.find((r) => r.source === "TH" && r.target === "KR")!.value).toBe(0.5);
    expect(records.find((r) => r.source === "KR" && r.target === "JP")).toBeUndefined();

    await runScore(PERIOD, storage, new Date("2026-08-16T00:00:00Z"));
    const edges = await runExport(PERIOD, storage);
    expect(edges).toHaveLength(5);
    const edge = edges.find((e) => e.source === "TH" && e.target === "JP")!;
    expect(edge.interestScore).toBe(100);
    expect(edge.signals.knowledge).toBe(100);
    expect(edge.confidence).toBe("low"); // single signal at M2

    const published = await getJson<EdgeRecord[]>(storage, "exports", `${PERIOD}/edges.json`);
    expect(published).toEqual(edges);
    const csv = await storage.get("exports", `${PERIOD}/edges.csv`);
    expect(csv).toContain("TH,JP,100");
  });

  it("normalize recomputes from stored raw data without touching the network", async () => {
    const { http, requests } = fakeHttp();
    const provider = new WikimediaPageviewsProvider(http);
    await provider
      .fetch(PERIOD, ["TH", "JP", "KR"], storage)
      .then(async (refs) => {
        const requestsAfterFetch = requests.length;
        const records = await provider.normalize(refs, storage);
        expect(records.length).toBeGreaterThan(0);
        expect(requests.length).toBe(requestsAfterFetch); // no network in normalize
      });
  });

  it("fails loudly when raw data is missing at normalize time", async () => {
    const provider = new WikimediaPageviewsProvider(fakeHttp().http);
    await expect(
      provider.normalize(
        [{ provider: provider.id, period: PERIOD, key: "wikimedia-pageviews/2026-07/TH.json" }],
        storage,
      ),
    ).rejects.toThrow(/re-run fetch/);
  });
});
