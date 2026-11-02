import { createHash } from "node:crypto";
import { z } from "zod";
import { AppError } from "@/lib/server/errors";
import {
  openStore,
  withStorageErrors,
  type BlobStore,
} from "@/lib/server/storage/blobs";

const STORE_NAME = "rp-limits";

function readLimit(
  name: string,
  fallback: number,
  min: number,
  max: number
): number {
  const raw = process.env[name];

  if (raw === undefined || raw.trim() === "") return fallback;

  const value = Number(raw);

  return Number.isInteger(value) && value >= min && value <= max
    ? value
    : fallback;
}

const CounterSchema = z.object({
  count: z.number().int().nonnegative(),
});

const SlotSchema = z.object({
  projectId: z.string().uuid(),
});

function clientIp(request: Request): string {
  const netlifyIp = request.headers
    .get("x-nf-client-connection-ip")
    ?.trim();

  return netlifyIp || "unknown";
}

async function readLegacyCount(
  store: BlobStore,
  key: string
): Promise<number> {
  const data: unknown = await store.get(key, { type: "json" });
  const parsed = CounterSchema.safeParse(data);

  return parsed.success ? parsed.data.count : 0;
}

/**
 * Claims one daily slot for a project.
 *
 * Each slot is a separate key. onlyIfNew prevents two different
 * projects from successfully claiming the same slot.
 *
 * A project can reclaim its own slot when retrying a request.
 */
async function claimSlot(
  store: BlobStore,
  prefix: string,
  limit: number,
  legacyCount: number,
  projectId: string
): Promise<{ key: string; created: boolean } | null> {
  for (let index = 0; index < limit; index += 1) {
    const key = `${prefix}/slot/${index}`;

    const existing: unknown = await store.get(key, { type: "json" });
    const parsed = SlotSchema.safeParse(existing);

    if (parsed.success && parsed.data.projectId === projectId) {
      return { key, created: false };
    }

    // Existing slots and slots already consumed by the old counter
    // cannot be claimed by a new project.
    if (existing !== null || index < legacyCount) {
      continue;
    }

    const result = await store.setJSON(
      key,
      { projectId },
      { onlyIfNew: true }
    );

    if (result.modified) {
      return { key, created: true };
    }

    // Another request may have claimed this slot at the same time.
    const afterRace: unknown = await store.get(key, { type: "json" });
    const raced = SlotSchema.safeParse(afterRace);

    if (raced.success && raced.data.projectId === projectId) {
      return { key, created: false };
    }
  }

  return null;
}

/**
 * Reserves one daily research slot when research actually starts.
 *
 * Limits:
 * - 3 projects per day globally.
 * - 2 projects per visitor IP per day.
 *
 * A project ID makes the reservation idempotent for that day.
 * Old counter values are respected during the transition.
 *
 * These limits reset at midnight UTC.
 */
export async function reserveRun(
  request: Request,
  projectId: string
): Promise<void> {
  const dailyRuns = readLimit("DAILY_MAX_RUNS", 3, 1, 3);
  const perIp = readLimit("DAILY_MAX_RUNS_PER_IP", 2, 1, 2);

  const day = new Date().toISOString().slice(0, 10);

  const ipHash = createHash("sha256")
    .update(clientIp(request))
    .digest("hex")
    .slice(0, 16);

  const globalPrefix = `global/${day}`;
  const ipPrefix = `ip/${day}/${ipHash}`;

  await withStorageErrors(async () => {
    const store = openStore(STORE_NAME);

    const [legacyGlobalCount, legacyIpCount] = await Promise.all([
      readLegacyCount(store, globalPrefix),
      readLegacyCount(store, ipPrefix),
    ]);

    // Claim the visitor slot first.
    const ipClaim = await claimSlot(
      store,
      ipPrefix,
      perIp,
      legacyIpCount,
      projectId
    );

    if (!ipClaim) {
      throw new AppError(
        "ip_limit",
        `You have reached the limit of ${perIp} research projects started per day from this connection. Please try again tomorrow.`,
        429
      );
    }

    // Then claim one of the global daily slots.
    const globalClaim = await claimSlot(
      store,
      globalPrefix,
      dailyRuns,
      legacyGlobalCount,
      projectId
    );

    if (!globalClaim) {
      // Release this visitor slot if this request created it.
      // Do not remove a slot that was already owned by this project.
      if (ipClaim.created) {
        await store.delete(ipClaim.key);
      }

      throw new AppError(
        "daily_limit",
        "Today's free research capacity has been used up. Please try again tomorrow. The limit resets at midnight UTC.",
        429
      );
    }
  });
}
