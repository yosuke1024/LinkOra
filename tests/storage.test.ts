import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalStorage } from "../src/storage/local.js";
import { getJson, putJson } from "../src/storage/types.js";

describe("LocalStorage", () => {
  let root: string;
  let storage: LocalStorage;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "linkora-test-"));
    storage = new LocalStorage(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("round-trips a value through put/get", async () => {
    await storage.put("raw", "provider/2026-08/TH.json", "hello");
    expect(await storage.get("raw", "provider/2026-08/TH.json")).toBe("hello");
  });

  it("returns null for missing keys", async () => {
    expect(await storage.get("raw", "missing.json")).toBeNull();
  });

  it("lists keys by prefix, sorted, using / separators", async () => {
    await storage.put("normalized", "2026-08/b.json", "{}");
    await storage.put("normalized", "2026-08/a.json", "{}");
    await storage.put("normalized", "2026-07/a.json", "{}");
    expect(await storage.list("normalized", "2026-08/")).toEqual([
      "2026-08/a.json",
      "2026-08/b.json",
    ]);
    expect(await storage.list("normalized", "nope/")).toEqual([]);
  });

  it("keeps layers isolated", async () => {
    await storage.put("raw", "same-key.json", "raw");
    await storage.put("exports", "same-key.json", "exports");
    expect(await storage.get("raw", "same-key.json")).toBe("raw");
    expect(await storage.get("exports", "same-key.json")).toBe("exports");
  });

  it("round-trips JSON via helpers", async () => {
    await putJson(storage, "exports", "2026-08/edges.json", [{ source: "TH", target: "JP" }]);
    expect(await getJson(storage, "exports", "2026-08/edges.json")).toEqual([
      { source: "TH", target: "JP" },
    ]);
  });
});
