import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalStorage } from "../src/storage/local.js";
import { getJson, putJson } from "../src/storage/types.js";
import { runScore } from "../src/pipeline/score.js";
import { runExport, edgesToCsv } from "../src/pipeline/export.js";
import type { EdgeRecord, SignalRecord } from "../src/types.js";

const PERIOD = "2026-07";
const NOW = new Date("2026-08-16T00:00:00Z");

const sampleRecords: SignalRecord[] = [
  {
    source: "TH",
    target: "JP",
    signal: "knowledge",
    provider: "test-provider",
    topic: null,
    value: 0.87,
    rawRef: "test-provider/2026-07/TH.json",
    period: PERIOD,
    observedAt: NOW.toISOString(),
  },
];

describe("score -> export stages", () => {
  let root: string;
  let storage: LocalStorage;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "linkora-pipeline-"));
    storage = new LocalStorage(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("scores normalized records and publishes json + csv exports", async () => {
    await putJson(storage, "normalized", `${PERIOD}/test-provider.json`, sampleRecords);

    const scored = await runScore(PERIOD, storage, NOW);
    expect(scored).toHaveLength(1);
    expect(scored[0]!.interestScore).toBe(87);

    const exported = await runExport(PERIOD, storage);
    expect(exported).toEqual(scored);

    const json = await getJson<EdgeRecord[]>(storage, "exports", `${PERIOD}/edges.json`);
    expect(json).toEqual(scored);

    const csv = await storage.get("exports", `${PERIOD}/edges.csv`);
    expect(csv).toContain("source,target,interestScore");
    expect(csv).toContain("TH,JP,87");
  });

  it("does not feed its own edges.json back into scoring on re-run", async () => {
    await putJson(storage, "normalized", `${PERIOD}/test-provider.json`, sampleRecords);
    const first = await runScore(PERIOD, storage, NOW);
    const second = await runScore(PERIOD, storage, NOW); // edges.json now exists in the layer
    expect(second).toEqual(first);
  });

  it("exports nothing when the period has not been scored", async () => {
    expect(await runExport(PERIOD, storage)).toEqual([]);
    expect(await storage.get("exports", `${PERIOD}/edges.csv`)).toBeNull();
  });

  it("escapes csv cells containing commas or quotes", () => {
    const edge: EdgeRecord = {
      source: 'T"H',
      target: "JP,X",
      interestScore: 1,
      informationSupply: null,
      informationGap: null,
      trend12m: null,
      signals: {},
      topics: [],
      confidence: "low",
      scoringVersion: "v0.0.1",
      period: PERIOD,
      observedAt: NOW.toISOString(),
    };
    const csv = edgesToCsv([edge]);
    expect(csv).toContain('"T""H","JP,X"');
  });
});
