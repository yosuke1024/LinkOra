/**
 * Storage abstraction over the three data layers (docs/IMPLEMENTATION_PLAN.md §2):
 *
 * - raw/        fetched source data, kept for recomputation (never published)
 * - normalized/ provider-normalized SignalRecords, accumulated per period
 * - exports/    edges.json / edges.csv / topics.json consumed by the dashboard
 *
 * Local filesystem is the default backend (data/ directory, gitignored).
 * Cloudflare R2 is selected via LINKORA_STORAGE=r2 once implemented.
 */
export const LAYERS = ["raw", "normalized", "exports"] as const;
export type Layer = (typeof LAYERS)[number];

export interface Storage {
  put(layer: Layer, key: string, body: string): Promise<void>;
  /** Returns null when the key does not exist. */
  get(layer: Layer, key: string): Promise<string | null>;
  /** Keys under a prefix, sorted lexicographically. */
  list(layer: Layer, prefix: string): Promise<string[]>;
}

export async function putJson(storage: Storage, layer: Layer, key: string, value: unknown): Promise<void> {
  await storage.put(layer, key, JSON.stringify(value, null, 2) + "\n");
}

export async function getJson<T>(storage: Storage, layer: Layer, key: string): Promise<T | null> {
  const body = await storage.get(layer, key);
  return body === null ? null : (JSON.parse(body) as T);
}
