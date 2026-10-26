import { getStore } from "@netlify/blobs";
import { getConfig } from "@/lib/server/env";
import { AppError } from "@/lib/server/errors";

export type BlobStore = ReturnType<typeof getStore>;

export function openStore(name: string): BlobStore {
  const { blobs } = getConfig();
  if (blobs) {
    return getStore({ name, siteID: blobs.siteId, token: blobs.token, consistency: "strong" });
  }
  return getStore({ name, consistency: "strong" });
}

/** Turns any storage failure into a clear AppError. */
export async function withStorageErrors<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof AppError) throw error;
    const detail = error instanceof Error ? error.message : "unknown error";
    throw new AppError("storage_error", `Storage failed: ${detail}`, 503);
  }
}
