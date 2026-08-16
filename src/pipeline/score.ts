import type { EdgeRecord, Period, SignalRecord } from "../types.js";
import type { Storage } from "../storage/types.js";
import { getJson, putJson } from "../storage/types.js";
import { composeEdges } from "../scoring/v0.js";

/**
 * Stage 3: aggregate all normalized SignalRecords for a period into
 * EdgeRecords, writing normalized/<period>/edges.json. Pure recomputation —
 * reads only the normalized layer.
 */
export async function runScore(
  period: Period,
  storage: Storage,
  now: Date = new Date(),
): Promise<EdgeRecord[]> {
  const keys = await storage.list("normalized", `${period}/`);
  const records: SignalRecord[] = [];
  for (const key of keys) {
    if (key.endsWith("/edges.json")) continue; // own previous output
    const batch = await getJson<SignalRecord[]>(storage, "normalized", key);
    if (batch) records.push(...batch);
  }

  const edges = composeEdges(records, period, now.toISOString());
  await putJson(storage, "normalized", `${period}/edges.json`, edges);
  console.log(`score: ${records.length} signal record(s) -> ${edges.length} edge(s)`);
  return edges;
}
