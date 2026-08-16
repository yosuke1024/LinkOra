import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import type { Layer, Storage } from "./types.js";

/**
 * Filesystem-backed storage. Layers map to subdirectories of the root
 * (default: ./data). Used for local runs and as the working store inside
 * GitHub Actions before syncing to R2.
 */
export class LocalStorage implements Storage {
  constructor(private readonly root: string = "data") {}

  private path(layer: Layer, key: string): string {
    return join(this.root, layer, key);
  }

  async put(layer: Layer, key: string, body: string): Promise<void> {
    const path = this.path(layer, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body, "utf8");
  }

  async get(layer: Layer, key: string): Promise<string | null> {
    try {
      return await readFile(this.path(layer, key), "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  async list(layer: Layer, prefix: string): Promise<string[]> {
    const layerRoot = join(this.root, layer);
    let entries;
    try {
      entries = await readdir(layerRoot, { recursive: true, withFileTypes: true });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
    return entries
      .filter((e) => e.isFile())
      .map((e) => relative(layerRoot, join(e.parentPath, e.name)).split(sep).join("/"))
      .filter((key) => key.startsWith(prefix))
      .sort();
  }
}
