import { z } from "zod";
import type { ServerConfig } from "@/lib/server/env";
import { buildUserAgent, SearchProviderError } from "@/lib/server/search/http";
import { cached } from "@/lib/server/storage/cacheStore";

const BASE = "https://api.crossref.org/works/";
const CACHE_TTL_SECONDS = 3 * 24 * 60 * 60;

export const DoiLookupSchema = z.object({
  found: z.boolean(),
  title: z.string().nullable(),
});
export type DoiLookup = z.infer<typeof DoiLookupSchema>;

const MessageSchema = z.object({
  message: z.object({ title: z.array(z.string()).optional() }),
});

async function fetchDoi(doi: string, config: ServerConfig, timeoutMs: number): Promise<DoiLookup> {
  const path = doi.split("/").map(encodeURIComponent).join("/");
  const query = config.contactEmail ? `?mailto=${encodeURIComponent(config.contactEmail)}` : "";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${BASE}${path}${query}`, {
      headers: { Accept: "application/json", "User-Agent": buildUserAgent(config.contactEmail) },
      signal: controller.signal,
      cache: "no-store",
    });

    if (response.status === 404) return { found: false, title: null };
    if (response.status === 429) {
      throw new SearchProviderError("crossref", "rate_limited", "Crossref: rate limit reached.");
    }
    if (!response.ok) {
      throw new SearchProviderError("crossref", "http_error", `Crossref: HTTP error ${response.status}.`);
    }

    const parsed = MessageSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new SearchProviderError("crossref", "bad_response", "Crossref: unexpected response format.");
    }
    return { found: true, title: parsed.data.message.title?.[0] ?? null };
  } catch (error) {
    if (error instanceof SearchProviderError) throw error;
    const timedOut = error instanceof Error && error.name === "AbortError";
    throw new SearchProviderError(
      "crossref",
      timedOut ? "timeout" : "network",
      timedOut ? "Crossref: request timed out." : "Crossref: could not be reached."
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Looks up a DOI in Crossref (cached 3 days). Throws on network/rate-limit problems. */
export async function lookupDoi(
  doi: string,
  config: ServerConfig,
  timeoutMs: number
): Promise<DoiLookup> {
  const { value } = await cached({
    namespace: "crossref-doi",
    key: doi,
    ttlSeconds: CACHE_TTL_SECONDS,
    schema: DoiLookupSchema,
    produce: () => fetchDoi(doi, config, timeoutMs),
  });
  return value;
}
