
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AppError } from "@/lib/server/errors";
import { openStore, withStorageErrors } from "@/lib/server/storage/blobs";

const STORE_NAME = "rp-project-locks";
const LOCK_LEASE_MS = 3 * 60 * 1000;
const MAX_CLAIM_ATTEMPTS = 4;

const LockSchema = z.object({
  ownerToken: z.string().uuid(),
  expiresAt: z.string().datetime(),
});

export type ProjectLock = {
  projectId: string;
  ownerToken: string;
  expiresAt: string;
};

function lockKey(projectId: string): string {
  return `project/${projectId}`;
}

function isValidEtag(etag: unknown): etag is string {
  return typeof etag === "string" && etag.trim().length > 0;
}

function createLock(projectId: string): ProjectLock {
  return {
    projectId,
    ownerToken: randomUUID(),
    expiresAt: new Date(Date.now() + LOCK_LEASE_MS).toISOString(),
  };
}

/**
 * Atomically claims a project lock.
 *
 * A new lock is created with onlyIfNew.
 * An expired lock is reclaimed with onlyIfMatch and its ETag.
 */
export async function acquireProjectLock(
  projectId: string
): Promise<ProjectLock> {
  return withStorageErrors(async () => {
    const store = openStore(STORE_NAME);
    const key = lockKey(projectId);

    for (let attempt = 0; attempt < MAX_CLAIM_ATTEMPTS; attempt += 1) {
      const candidate = createLock(projectId);

      const existing = await store.getWithMetadata(key, {
        type: "json",
        consistency: "strong",
      });

      if (existing === null) {
        const result = await store.setJSON(key, candidate, {
          onlyIfNew: true,
        });

        if (result.modified && isValidEtag(result.etag)) {
          return candidate;
        }

        if (result.modified) {
          throw new AppError(
            "lock_unavailable",
            "The research lock could not be verified. Please try again.",
            503
          );
        }

        // Another request claimed the lock first. Read it again.
        continue;
      }

      const parsed = LockSchema.safeParse(existing.data);

      if (!parsed.success) {
        throw new AppError(
          "lock_unavailable",
          "The project lock contains invalid data. Please contact support.",
          503
        );
      }

      const expiry = Date.parse(parsed.data.expiresAt);

      if (!Number.isFinite(expiry)) {
        throw new AppError(
          "lock_unavailable",
          "The project lock has an invalid expiry time.",
          503
        );
      }

      if (expiry > Date.now()) {
        throw new AppError(
          "step_in_progress",
          "A research step is already running. Wait a moment and try again.",
          409
        );
      }

      // Reclaim an expired lock only if its ETag has not changed.
      if (!isValidEtag(existing.etag)) {
        throw new AppError(
          "lock_unavailable",
          "The expired project lock could not be verified.",
          503
        );
      }

      const result = await store.setJSON(key, candidate, {
        onlyIfMatch: existing.etag,
      });

      if (result.modified && isValidEtag(result.etag)) {
        return candidate;
      }

      if (result.modified) {
        throw new AppError(
          "lock_unavailable",
          "The reclaimed lock could not be verified. Please try again.",
          503
        );
      }

      // The lock changed while we were reclaiming it. Retry.
    }

    throw new AppError(
      "step_in_progress",
      "Another request is claiming this project. Please wait a moment and try again.",
      409
    );
  });
}

/**
 * Confirms that this request still owns an unexpired project lock.
 * Call this immediately before saving an agent result.
 */
export async function assertProjectLock(
  lock: ProjectLock
): Promise<void> {
  await withStorageErrors(async () => {
    const store = openStore(STORE_NAME);

    const current = await store.getWithMetadata(
      lockKey(lock.projectId),
      {
        type: "json",
        consistency: "strong",
      }
    );

    if (current === null) {
      throw new AppError(
        "lock_lost",
        "This research run no longer owns the project lock. Its result was not saved.",
        409
      );
    }

    const parsed = LockSchema.safeParse(current.data);

    if (
      !parsed.success ||
      parsed.data.ownerToken !== lock.ownerToken ||
      Date.parse(parsed.data.expiresAt) <= Date.now()
    ) {
      throw new AppError(
        "lock_lost",
        "This research run no longer owns the project lock. Its result was not saved.",
        409
      );
    }
  });
}

/**
 * Releases the lock only if this request still owns it.
 *
 * The record is marked expired using an ETag-conditional write.
 * It is not deleted, because deletion is not conditional.
 */
export async function releaseProjectLock(
  lock: ProjectLock
): Promise<void> {
  try {
    await withStorageErrors(async () => {
      const store = openStore(STORE_NAME);

      const current = await store.getWithMetadata(
        lockKey(lock.projectId),
        {
          type: "json",
          consistency: "strong",
        }
      );

      if (current === null || !isValidEtag(current.etag)) {
        return;
      }

      const parsed = LockSchema.safeParse(current.data);

      if (
        !parsed.success ||
        parsed.data.ownerToken !== lock.ownerToken
      ) {
        return;
      }

      await store.setJSON(
        lockKey(lock.projectId),
        {
          ownerToken: lock.ownerToken,
          expiresAt: new Date(0).toISOString(),
        },
        {
          onlyIfMatch: current.etag,
        }
      );
    });
  } catch (error) {
    // A failed release is safe: the lock will expire automatically.
    console.error("Could not release project lock:", error);
  }
}
