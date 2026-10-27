import { createHash } from "node:crypto";
import { z } from "zod";
import { AppError } from "@/lib/server/errors";
import { openStore, withStorageErrors, type BlobStore } from "@/lib/server/storage/blobs";

const STORE_NAME = "rp-limits";

function readLimit(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

const CounterSchema = z.object({ count: z.number().int().nonnegative() });

// Netlify sets x-nf-client-connection-ip to the real visitor address.
function clientIp(request: Request): string {
  const netlify = request.headers.get("x-nf-client-connection-ip");
  if (netlify) return netlify.trim();
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

async function readCount(store: BlobStore, key: string): Promise<number> {
  const data: unknown = await store.get(key, { type: "json" });
  const parsed = CounterSchema.safeParse(data);
  return parsed.success ? parsed.data.count : 0;
}

/**
 * Protects the shared free quotas of a public site: a daily cap for the whole site and
 * a daily cap per visitor address (stored only as a hash). Counts are saved in storage and
 * reset every day at midnight UTC. Counting is not perfectly exact if two requests arrive
 * at the same instant, so a tiny overshoot is possible.
 *
 * Defaults fit Groq's free tier: 3 runs x up to 60,000 tokens stays under 200,000 per day.
 */
export async function reserveRun(request: Request): Promise<void> {
  const dailyRuns = readLimit("DAILY_MAX_RUNS", 3, 1, 1000);
  const perIp = readLimit("DAILY_MAX_RUNS_PER_IP", 2, 1, 1000);

  const day = new Date().toISOString().slice(0, 10);
  const ipHash = createHash("sha256").update(clientIp(request)).digest("hex").slice(0, 16);
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
        "Today's free research capacity has been used up. This site runs on free services, so please try again tomorrow (it resets at midnight UTC).",
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
      store.setJSON(globalKey, { count: globalCount + 1 }),
      store.setJSON(ipKey, { count: ipCount + 1 }),
    ]);
  });
}
