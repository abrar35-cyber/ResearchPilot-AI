
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

/**
 * Trust only Netlify's connection IP header.
 *
 * Do not use x-forwarded-for as a fallback because clients may be able
 * to supply or manipulate that header.
 */
function clientIp(request: Request): string {
  const netlifyIp = request.headers
    .get("x-nf-client-connection-ip")
    ?.trim();

  return netlifyIp || "unknown";
}

async function readCount(
  store: BlobStore,
  key: string
): Promise<number> {
  const data: unknown = await store.get(key, { type: "json" });
  const parsed = CounterSchema.safeParse(data);

  return parsed.success ? parsed.data.count : 0;
}

/**
 * Protects the shared free-service capacity.
 *
 * Hard limits:
 * - Maximum 3 research projects created per day globally.
 * - Maximum 2 research projects created per visitor IP per day.
 *
 * The default Groq GPT-OSS 120B free-tier token allowance is documented
 * as 200,000 tokens per day. The application separately limits each
 * research run to 60,000 tokens.
 *
 * These counters reset at midnight UTC.
 *
 * Netlify Blobs does not provide an atomic increment here. Concurrent
 * requests can still cause a small overshoot.
 */
export async function reserveRun(request: Request): Promise<void> {
  const dailyRuns = readLimit(
    "DAILY_MAX_RUNS",
    3,
    1,
    3
  );

  const perIp = readLimit(
    "DAILY_MAX_RUNS_PER_IP",
    2,
    1,
    2
  );

  const day = new Date().toISOString().slice(0, 10);

  const ipHash = createHash("sha256")
    .update(clientIp(request))
    .digest("hex")
    .slice(0, 16);

  const globalKey = `global/${day}`;
  const ipKey = `ip/${day}/${ipHash}`;

  await withStorageErrors(async () => {
    const store = openStore(STORE_NAME);

    const [globalCount, ipCount] = await Promise.all([
      readCount(store, globalKey),
      readCount(store, ipKey),
    ]);

    if (globalCount >= dailyRuns) {
      throw new AppError(
        "daily_limit",
        "Today's free research capacity has been used up. Please try again tomorrow. The limit resets at midnight UTC.",
        429
      );
    }

    if (ipCount >= perIp) {
      throw new AppError(
        "ip_limit",
        `You have reached the limit of ${perIp} research runs per day on this free service. Please try again tomorrow.`,
        429
      );
    }

    await Promise.all([
      store.setJSON(globalKey, {
        count: globalCount + 1,
      }),
      store.setJSON(ipKey, {
        count: ipCount + 1,
      }),
    ]);
  });
}
