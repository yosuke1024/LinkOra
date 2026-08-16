import { COUNTRY_CODES } from "../../config/countries.js";
import { enabledProviders } from "../../config/providers.js";
import type { Period, RawRef } from "../types.js";
import type { Storage } from "../storage/types.js";
import { putJson } from "../storage/types.js";

/**
 * Stage 1: fetch raw data from every enabled provider and record a manifest
 * of RawRefs per provider under raw/<provider>/<period>/manifest.json.
 * The manifest is what Stage 2 reads, so normalize never re-hits the network.
 */
export async function runFetch(period: Period, storage: Storage): Promise<RawRef[]> {
  const refs: RawRef[] = [];
  for (const provider of enabledProviders()) {
    const providerRefs = await provider.fetch(period, COUNTRY_CODES, storage);
    await putJson(storage, "raw", `${provider.id}/${period}/manifest.json`, providerRefs);
    refs.push(...providerRefs);
    console.log(`fetch: ${provider.id} -> ${providerRefs.length} raw object(s)`);
  }
  if (refs.length === 0) {
    console.log("fetch: no providers enabled (config/providers.ts) — nothing fetched");
  }
  return refs;
}
