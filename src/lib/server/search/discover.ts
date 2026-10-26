import { z } from "zod";
import { SourceSchema, type Source } from "@/lib/schemas/research";
import type { ServerConfig } from "@/lib/server/env";
import { AppError } from "@/lib/server/errors";
import { cached } from "@/lib/server/storage/cacheStore";
import { dedupeSources } from "@/lib/server/search/dedupe";
import { searchCrossref } from "@/lib/server/search/crossref";
import { searchDuckDuckGo } from "@/lib/server/search/duckduckgo";
import { PROVIDER_LABELS, SearchProviderError, type SearchProvider } from "@/lib/server/search/http";
import { searchOpenAlex } from "@/lib/server/search/openalex";

const MAX_QUERIES = 4;
const MAX_QUERY_LENGTH = 200;
const REQUEST_TIMEOUT_MS = 8000;
const DEFAULT_DEADLINE_MS = 20000;
const CACHE_TTL_SECONDS = 24 * 60 * 60;

type ProviderRun = (
  query: string,
  limit: number,
  config: ServerConfig,
  timeoutMs: number
) => Promise<Source[]>;

// Order matters: academic providers first.
const PROVIDERS: { name: SearchProvider; run: ProviderRun }[] = [
  { name: "openalex", run: searchOpenAlex },
  { name: "crossref", run: searchCrossref },
  { name: "duckduckgo", run: searchDuckDuckGo },
];

export interface DiscoverOptions {
  maxSources: number;
  perProviderLimit?: number;
  /** Absolute time (Date.now() style) after which no new search is started. */
  deadlineAt?: number;
}

export interface DiscoverResult {
  sources: Source[];
  /** Plain-language messages about skipped providers, failures and limits. */
  notes: string[];
  stats: {
    queriesRun: number;
    cacheHits: number;
    freshRequests: number;
    found: number;
    duplicatesRemoved: number;
    droppedOverLimit: number;
    rawPerProvider: Record<SearchProvider, number>;
  };
}

async function runProvider(
  provider: { name: SearchProvider; run: ProviderRun },
  query: string,
  limit: number,
  config: ServerConfig,
  timeoutMs: number
): Promise<{ sources: Source[]; fromCache: boolean }> {
  const { value, fromCache } = await cached({
    namespace: `search-${provider.name}`,
    key: `${limit}|${query.toLowerCase()}`,
    ttlSeconds: CACHE_TTL_SECONDS,
    schema: z.array(SourceSchema),
    produce: () => provider.run(query, limit, config, timeoutMs),
  });
  return { sources: value, fromCache };
}

// Alternate between providers so the source limit does not favour just one.
function interleave(lists: Source[][]): Source[] {
  const out: Source[] = [];
  const longest = Math.max(0, ...lists.map((list) => list.length));
  for (let i = 0; i < longest; i++) {
    for (const list of lists) {
      if (i < list.length) out.push(list[i]);
    }
  }
  return out;
}

/**
 * Searches all providers for each query (cached for 24 hours), then removes
 * duplicates and caps the result. A failing provider never stops the others:
 * it is reported in `notes` instead.
 */
export async function discoverSources(
  queries: string[],
  config: ServerConfig,
  options: DiscoverOptions
): Promise<DiscoverResult> {
  const deadline = options.deadlineAt ?? Date.now() + DEFAULT_DEADLINE_MS;
  const limit = options.perProviderLimit ?? 10;

  const cleanQueries = Array.from(
    new Set(
      queries
        .map((q) => q.replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH))
        .filter((q) => q.length >= 3)
    )
  ).slice(0, MAX_QUERIES);

  if (cleanQueries.length === 0) {
    throw new AppError("invalid_query", "Provide at least one search query of 3+ characters.", 400);
  }

  const notes = new Set<string>();
  const raw: Record<SearchProvider, Source[]> = { openalex: [], crossref: [], duckduckgo: [] };
  let queriesRun = 0;
  let cacheHits = 0;
  let freshRequests = 0;

  for (const query of cleanQueries) {
    const timeLeft = deadline - Date.now();
    if (timeLeft < 1500) {
      notes.add("Searching stopped early to stay within the time limit; some queries were not run.");
      break;
    }
    const timeoutMs = Math.min(REQUEST_TIMEOUT_MS, timeLeft - 500);
    queriesRun += 1;

    const settled = await Promise.allSettled(
      PROVIDERS.map((provider) => runProvider(provider, query, limit, config, timeoutMs))
    );

    settled.forEach((outcome, i) => {
      const provider = PROVIDERS[i];
      if (outcome.status === "fulfilled") {
        raw[provider.name].push(...outcome.value.sources);
        if (outcome.value.fromCache) cacheHits += 1;
        else freshRequests += 1;
      } else {
        freshRequests += 1;
        const reason: unknown = outcome.reason;
        notes.add(
          reason instanceof SearchProviderError
            ? reason.message
            : `${PROVIDER_LABELS[provider.name]}: unexpected error.`
        );
      }
    });
  }

  const merged = interleave([raw.openalex, raw.crossref, raw.duckduckgo]);
  const deduped = dedupeSources(merged, options.maxSources);

  if (deduped.sources.length === 0) {
    notes.add("No sources were found. Try different or shorter search terms.");
  }
  if (deduped.droppedOverLimit > 0) {
    notes.add(`More sources were found than the limit of ${options.maxSources}; the extra ones were not used.`);
  }

  return {
    sources: deduped.sources,
    notes: Array.from(notes),
    stats: {
      queriesRun,
      cacheHits,
      freshRequests,
      found: deduped.sources.length,
      duplicatesRemoved: deduped.duplicatesRemoved,
      droppedOverLimit: deduped.droppedOverLimit,
      rawPerProvider: {
        openalex: raw.openalex.length,
        crossref: raw.crossref.length,
        duckduckgo: raw.duckduckgo.length,
      },
    },
  };
}
