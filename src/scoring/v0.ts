import type { Confidence, EdgeRecord, SignalKind, SignalRecord, TopicScore } from "../types.js";
import type { Period } from "../types.js";

/**
 * Scoring v0 (skeleton for M0 — see docs/scoring/v0.md).
 *
 * Bump this version whenever the composition below changes, and record the
 * change in docs/scoring/. Every EdgeRecord carries the version it was
 * computed with so past periods can be recomputed and compared.
 */
export const SCORING_VERSION = "v0.0.1";

/**
 * v0 composition, deliberately minimal:
 * - per-signal score  = mean of that signal's record values on the edge, scaled to 0–100
 * - interestScore     = unweighted mean of the available non-supply signal scores
 * - informationSupply = the supply signal score when present, else null
 * - informationGap    = interest - supply when both exist, else null
 * - confidence        = by count of distinct non-supply signals (1: low, 2: medium, 3+: high)
 * - trend12m          = null (computed at M3 from the period series, not here)
 *
 * Pure function: same records in, same edges out.
 */
export function composeEdges(
  records: readonly SignalRecord[],
  period: Period,
  observedAt: string,
): EdgeRecord[] {
  const byEdge = new Map<string, SignalRecord[]>();
  for (const record of records) {
    if (record.period !== period) continue;
    const key = `${record.source}->${record.target}`;
    const group = byEdge.get(key);
    if (group) group.push(record);
    else byEdge.set(key, [record]);
  }

  const edges: EdgeRecord[] = [];
  for (const group of byEdge.values()) {
    const { source, target } = group[0]!;
    const signals = signalScores(group);
    const topics = topicScores(group);

    const interestKinds = (Object.keys(signals) as SignalKind[]).filter((k) => k !== "supply");
    if (interestKinds.length === 0) continue;
    const interestScore = round1(
      interestKinds.reduce((sum, kind) => sum + signals[kind]!, 0) / interestKinds.length,
    );
    const informationSupply = signals.supply ?? null;
    const informationGap =
      informationSupply === null ? null : round1(interestScore - informationSupply);

    edges.push({
      source,
      target,
      interestScore,
      informationSupply,
      informationGap,
      trend12m: null,
      signals,
      topics,
      confidence: confidenceFor(interestKinds.length),
      scoringVersion: SCORING_VERSION,
      period,
      observedAt,
    });
  }

  return edges.sort((a, b) =>
    a.source === b.source ? a.target.localeCompare(b.target) : a.source.localeCompare(b.source),
  );
}

function signalScores(group: readonly SignalRecord[]): Partial<Record<SignalKind, number>> {
  const sums = new Map<SignalKind, { total: number; count: number }>();
  for (const record of group) {
    if (record.topic !== null) continue; // country-level records only
    const entry = sums.get(record.signal) ?? { total: 0, count: 0 };
    entry.total += record.value;
    entry.count += 1;
    sums.set(record.signal, entry);
  }
  const scores: Partial<Record<SignalKind, number>> = {};
  for (const [kind, { total, count }] of sums) {
    scores[kind] = round1((total / count) * 100);
  }
  return scores;
}

function topicScores(group: readonly SignalRecord[]): TopicScore[] {
  const sums = new Map<string, { total: number; count: number }>();
  for (const record of group) {
    if (record.topic === null) continue;
    const entry = sums.get(record.topic) ?? { total: 0, count: 0 };
    entry.total += record.value;
    entry.count += 1;
    sums.set(record.topic, entry);
  }
  return [...sums.entries()]
    .map(([topic, { total, count }]) => ({ topic, score: round1((total / count) * 100) }))
    .sort((a, b) => b.score - a.score);
}

function confidenceFor(interestSignalCount: number): Confidence {
  if (interestSignalCount >= 3) return "high";
  if (interestSignalCount === 2) return "medium";
  return "low";
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
