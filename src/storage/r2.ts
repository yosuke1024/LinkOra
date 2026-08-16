import type { Layer, Storage } from "./types.js";
import { LocalStorage } from "./local.js";

/**
 * Cloudflare R2 storage backend (S3-compatible API).
 *
 * Not implemented at M0 — the pipeline runs against LocalStorage until the
 * R2 bucket and credentials are provisioned. Selected via LINKORA_STORAGE=r2
 * with LINKORA_R2_ACCOUNT_ID / LINKORA_R2_BUCKET /
 * LINKORA_R2_ACCESS_KEY_ID / LINKORA_R2_SECRET_ACCESS_KEY.
 */
export class R2Storage implements Storage {
  constructor() {
    throw new Error(
      "R2Storage is not implemented yet. Use LocalStorage (unset LINKORA_STORAGE) until R2 is provisioned.",
    );
  }

  put(_layer: Layer, _key: string, _body: string): Promise<void> {
    return Promise.reject(new Error("not implemented"));
  }

  get(_layer: Layer, _key: string): Promise<string | null> {
    return Promise.reject(new Error("not implemented"));
  }

  list(_layer: Layer, _prefix: string): Promise<string[]> {
    return Promise.reject(new Error("not implemented"));
  }
}

export function createStorage(): Storage {
  const backend = process.env.LINKORA_STORAGE ?? "local";
  if (backend === "r2") return new R2Storage();
  return new LocalStorage(process.env.LINKORA_DATA_DIR ?? "data");
}
