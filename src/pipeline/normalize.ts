import { enabledProviders } from "../../config/providers.js";
import type { Period, RawRef, SignalRecord } from "../types.js";
import type { Provider } from "../providers/types.js";
import type { Storage } from "../storage/types.js";
import { getJson, putJson } from "../storage/types.js";

/**
 * Stage 2: turn raw data into SignalRecords via each provider's normalize(),
 * writing normalized/<period>/<provider>.json. Reads only the raw layer —
 * re-runnable without network access.
 */
export async function runNormalize(
  period: Period,
  storage: Storage,
  providers: readonly Provider[] = enabledProviders(),
): Promise<SignalRecord[]> {
  const all: SignalRecord[] = [];
  for (const provider of providers) {
    const manifest = await getJson<RawRef[]>(
      storage,
      "raw",
      `${provider.id}/${period}/manifest.json`,
    );
    if (manifest === null) {
      console.log(`normalize: no raw manifest for ${provider.id} ${period} — skipped (run fetch first)`);
      continue;
    }
    const records = await provider.normalize(manifest, storage);
    await putJson(storage, "normalized", `${period}/${provider.id}.json`, records);
    all.push(...records);
    console.log(`normalize: ${provider.id} -> ${records.length} signal record(s)`);
  }
  if (all.length === 0) {
    console.log("normalize: no signal records produced");
  }
  return all;
}
