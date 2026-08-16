import { describe, expect, it } from "vitest";
import { composeEdges, SCORING_VERSION } from "../src/scoring/v0.js";
import type { SignalRecord } from "../src/types.js";

const OBSERVED_AT = "2026-08-16T00:00:00.000Z";

function record(overrides: Partial<SignalRecord>): SignalRecord {
  return {
    source: "TH",
    target: "JP",
    signal: "knowledge",
    provider: "test-provider",
    topic: null,
    value: 0.5,
    rawRef: "test/raw.json",
    period: "2026-07",
    observedAt: OBSERVED_AT,
    ...overrides,
  };
}

describe("composeEdges (scoring v0)", () => {
  it("is deterministic: same records in, same edges out", () => {
    const records = [record({ value: 0.8 }), record({ signal: "travel", value: 0.6 })];
    const a = composeEdges(records, "2026-07", OBSERVED_AT);
    const b = composeEdges(records, "2026-07", OBSERVED_AT);
    expect(a).toEqual(b);
  });

  it("averages signals into interestScore and stamps the scoring version", () => {
    const edges = composeEdges(
      [record({ signal: "knowledge", value: 0.8 }), record({ signal: "travel", value: 0.6 })],
      "2026-07",
      OBSERVED_AT,
    );
    expect(edges).toHaveLength(1);
    const edge = edges[0]!;
    expect(edge.signals).toEqual({ knowledge: 80, travel: 60 });
    expect(edge.interestScore).toBe(70);
    expect(edge.confidence).toBe("medium");
    expect(edge.scoringVersion).toBe(SCORING_VERSION);
    expect(edge.trend12m).toBeNull();
  });

  it("keeps directed edges separate", () => {
    const edges = composeEdges(
      [
        record({ source: "TH", target: "JP", value: 0.9 }),
        record({ source: "JP", target: "TH", value: 0.2 }),
      ],
      "2026-07",
      OBSERVED_AT,
    );
    expect(edges).toHaveLength(2);
    const thJp = edges.find((e) => e.source === "TH")!;
    const jpTh = edges.find((e) => e.source === "JP")!;
    expect(thJp.interestScore).toBe(90);
    expect(jpTh.interestScore).toBe(20);
  });

  it("computes informationGap only when a supply signal exists", () => {
    const withSupply = composeEdges(
      [record({ signal: "knowledge", value: 0.9 }), record({ signal: "supply", value: 0.6 })],
      "2026-07",
      OBSERVED_AT,
    )[0]!;
    expect(withSupply.interestScore).toBe(90); // supply excluded from interest
    expect(withSupply.informationSupply).toBe(60);
    expect(withSupply.informationGap).toBe(30);

    const withoutSupply = composeEdges([record({})], "2026-07", OBSERVED_AT)[0]!;
    expect(withoutSupply.informationSupply).toBeNull();
    expect(withoutSupply.informationGap).toBeNull();
  });

  it("derives confidence from the number of distinct interest signals", () => {
    const one = composeEdges([record({})], "2026-07", OBSERVED_AT)[0]!;
    expect(one.confidence).toBe("low");
    const three = composeEdges(
      [
        record({ signal: "knowledge" }),
        record({ signal: "travel" }),
        record({ signal: "search" }),
      ],
      "2026-07",
      OBSERVED_AT,
    )[0]!;
    expect(three.confidence).toBe("high");
  });

  it("separates topic records from country-level signals", () => {
    const edge = composeEdges(
      [
        record({ value: 0.8 }),
        record({ topic: "travel", value: 0.94 }),
        record({ topic: "food", value: 0.89 }),
      ],
      "2026-07",
      OBSERVED_AT,
    )[0]!;
    expect(edge.signals).toEqual({ knowledge: 80 }); // topics not mixed in
    expect(edge.topics).toEqual([
      { topic: "travel", score: 94 },
      { topic: "food", score: 89 },
    ]);
  });

  it("ignores records from other periods", () => {
    const edges = composeEdges(
      [record({ period: "2026-06" }), record({ period: "2026-07", value: 0.7 })],
      "2026-07",
      OBSERVED_AT,
    );
    expect(edges).toHaveLength(1);
    expect(edges[0]!.interestScore).toBe(70);
  });
});
