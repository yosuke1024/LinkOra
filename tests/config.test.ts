import { describe, expect, it } from "vitest";
import { COUNTRIES, COUNTRY_CODES, directedEdges } from "../config/countries.js";
import { TOPICS, TOPIC_IDS, isKnownTopic } from "../config/topics.js";

describe("countries config", () => {
  it("holds exactly the 10 MVP countries", () => {
    expect(COUNTRIES).toHaveLength(10);
  });

  it("uses unique, valid ISO 3166-1 alpha-2 codes", () => {
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length);
    for (const code of COUNTRY_CODES) {
      expect(code).toMatch(/^[A-Z]{2}$/);
    }
  });

  it("produces 90 directed edges for 10 countries", () => {
    const edges = directedEdges();
    expect(edges).toHaveLength(90);
    // Directionality: TH->JP and JP->TH are distinct edges.
    expect(edges).toContainEqual({ source: "TH", target: "JP" });
    expect(edges).toContainEqual({ source: "JP", target: "TH" });
    // No self-loops.
    expect(edges.every((e) => e.source !== e.target)).toBe(true);
  });
});

describe("topics config", () => {
  it("has unique lowercase ids", () => {
    expect(new Set(TOPIC_IDS).size).toBe(TOPICS.length);
    for (const id of TOPIC_IDS) {
      expect(id).toMatch(/^[a-z]+$/);
    }
  });

  it("recognizes known and unknown topics", () => {
    expect(isKnownTopic("travel")).toBe(true);
    expect(isKnownTopic("nonexistent")).toBe(false);
  });
});
