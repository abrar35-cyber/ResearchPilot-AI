import type { Source } from "@/lib/schemas/research";
import { normalizeDoi, normalizeTitle, normalizeUrl } from "@/lib/server/search/normalize";

function keysFor(source: Source): string[] {
  const keys: string[] = [];
  const doi = normalizeDoi(source.doi);
  if (doi) keys.push(`doi:${doi}`);
  const url = normalizeUrl(source.url);
  if (url) keys.push(`url:${url}`);
  const title = normalizeTitle(source.title);
  // Very short titles are too generic to match safely.
  if (title.length >= 15) keys.push(`title:${title}|${source.year ?? ""}`);
  return keys;
}

function longer(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return b.length > a.length ? b : a;
}

// Keeps the first record and fills any gaps from the duplicate.
function merge(base: Source, extra: Source): Source {
  return {
    ...base,
    doi: base.doi ?? extra.doi,
    url: base.url ?? extra.url,
    year: base.year ?? extra.year,
    authors: base.authors.length > 0 ? base.authors : extra.authors,
    snippet: longer(base.snippet, extra.snippet),
  };
}

export interface DedupeResult {
  sources: Source[];
  duplicatesRemoved: number;
  droppedOverLimit: number;
}

/** Removes duplicates (same DOI, URL or title+year) and keeps at most `max` sources. */
export function dedupeSources(sources: Source[], max: number): DedupeResult {
  const result: Source[] = [];
  const index = new Map<string, number>();
  let duplicatesRemoved = 0;
  let droppedOverLimit = 0;

  for (const source of sources) {
    const keys = keysFor(source);
    const hit = keys
      .map((key) => index.get(key))
      .find((position): position is number => position !== undefined);

    if (hit !== undefined) {
      result[hit] = merge(result[hit], source);
      duplicatesRemoved += 1;
      for (const key of keysFor(result[hit])) index.set(key, hit);
      continue;
    }

    if (result.length >= max) {
      droppedOverLimit += 1;
      continue;
    }

    result.push(source);
    for (const key of keys) index.set(key, result.length - 1);
  }

  return { sources: result, duplicatesRemoved, droppedOverLimit };
}
