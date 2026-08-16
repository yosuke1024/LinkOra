import type { EdgeRecord, Period } from "../types.js";
import type { Storage } from "../storage/types.js";
import { getJson, putJson } from "../storage/types.js";

/**
 * Stage 4: publish the period's EdgeRecords to the exports layer as
 * edges.json and edges.csv (the formats the dashboard and Loka consume).
 */
export async function runExport(period: Period, storage: Storage): Promise<EdgeRecord[]> {
  const edges = await getJson<EdgeRecord[]>(storage, "normalized", `${period}/edges.json`);
  if (edges === null) {
    console.log(`export: no scored edges for ${period} — run score first`);
    return [];
  }
  await putJson(storage, "exports", `${period}/edges.json`, edges);
  await storage.put("exports", `${period}/edges.csv`, edgesToCsv(edges));
  console.log(`export: wrote exports/${period}/edges.{json,csv} (${edges.length} edge(s))`);

  const top = [...edges].sort((a, b) => b.interestScore - a.interestScore).slice(0, 10);
  if (top.length > 0) {
    console.log("export: top edges by interestScore:");
    for (const edge of top) {
      console.log(
        `  ${edge.source} -> ${edge.target}  interest=${edge.interestScore}  confidence=${edge.confidence}`,
      );
    }
  }
  return edges;
}

const CSV_COLUMNS = [
  "source",
  "target",
  "interestScore",
  "informationSupply",
  "informationGap",
  "trend12m",
  "confidence",
  "scoringVersion",
  "period",
  "observedAt",
] as const;

export function edgesToCsv(edges: readonly EdgeRecord[]): string {
  const lines = [CSV_COLUMNS.join(",")];
  for (const edge of edges) {
    lines.push(CSV_COLUMNS.map((column) => csvCell(edge[column])).join(","));
  }
  return lines.join("\n") + "\n";
}

function csvCell(value: string | number | null): string {
  if (value === null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
