import { createHash } from "node:crypto";
import { z } from "zod";
import { openStore } from "@/lib/server/storage/blobs";

const STORE_NAME = "rp-cache";

const EntrySchema = z.object({
  expiresAt: z.number(),
  value: z.unknown(),
});

function blobKey(namespace: string, key: string): string {
  const hash = createHash("sha256").update(key.trim()).digest("hex");
  return `${namespace}/${hash}`;
}

interface CachedOptions<T> {
  namespace: string; // e.g. "search" or "extract"
  key: string; // e.g. provider + normalized query, or a URL
  ttlSeconds: number;
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  produce: () => Promise<T>;
}

/**
 * Returns a saved result if one exists and is still fresh, otherwise runs
 * produce() and saves its result. Cache problems never break a research run:
 * a failed read counts as a miss and a failed write is ignored.
 */
export async function cached<T>(
  options: CachedOptions<T>
): Promise<{ value: T; fromCache: boolean }> {
  const key = blobKey(options.namespace, options.key);

  try {
    const stored: unknown = await openStore(STORE_NAME).get(key, { type: "json" });
    const entry = EntrySchema.safeParse(stored);
    if (entry.success && entry.data.expiresAt > Date.now()) {
      const value = options.schema.safeParse(entry.data.value);
      if (value.success) return { value: value.data, fromCache: true };
    }
  } catch {
    // treat as a cache miss
  }

  const value = await options.produce();

  try {
    await openStore(STORE_NAME).setJSON(key, {
      expiresAt: Date.now() + options.ttlSeconds * 1000,
      value,
    });
  } catch {
    // ignore cache write failures
  }

  return { value, fromCache: false };
}
