import { createHash } from "node:crypto";
import type { Source } from "@/lib/schemas/research";

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&#39;": "'",
  "&nbsp;": " ",
};

/** Removes HTML/XML tags, decodes common entities and collapses whitespace. */
export function cleanText(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39);/g, (match) => ENTITIES[match] ?? match)
    .replace(/&#(\d{1,6});/g, (_match, code: string) => {
      const n = Number(code);
      return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : " ";
    })
    .replace(/\s+/g, " ")
    .trim();
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

export function normalizeDoi(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)/, "");
  return /^10\.\d{4,9}\/\S+$/.test(cleaned) ? cleaned : null;
}

/** Returns the URL only if it is a valid http(s) URL. */
export function safeHttpUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

const TRACKING_PARAM = /^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$|ref$)/i;

/** A comparison key for URLs (not for fetching): no protocol, www, hash or tracking params. */
export function normalizeUrl(raw: string | null | undefined): string | null {
  const safe = safeHttpUrl(raw);
  if (!safe) return null;
  const url = new URL(safe);
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const kept = [...url.searchParams.entries()]
    .filter(([name]) => !TRACKING_PARAM.test(name))
    .sort(([a], [b]) => a.localeCompare(b));
  const query = new URLSearchParams(kept).toString();
  const path = url.pathname.replace(/\/+$/, "");
  return `${host}${path}${query ? `?${query}` : ""}`;
}

/** A comparison key for titles (works for Latin and Arabic script). */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[\s!-\/:-@\[-`{-~“”‘’–—…،؛؟۔]+/g, " ")
    .trim();
}

export function makeSourceId(doi: string | null, url: string | null, title: string): string {
  const basis = doi
    ? `doi:${doi}`
    : url
      ? `url:${normalizeUrl(url) ?? url}`
      : `title:${normalizeTitle(title)}`;
  return `src_${createHash("sha1").update(basis).digest("hex").slice(0, 16)}`;
}

/** Rebuilds an OpenAlex abstract from its inverted index. */
export function abstractFromInvertedIndex(
  index: Record<string, number[]> | null | undefined
): string | null {
  if (!index) return null;
  const words: string[] = [];
  for (const [word, positions] of Object.entries(index)) {
    for (const position of positions) {
      if (position >= 0 && position < 5000) words[position] = word;
    }
  }
  const text = cleanText(words.filter(Boolean).join(" "));
  return text === "" ? null : text;
}

export interface SourceDraft {
  title: string;
  url: string | null;
  doi: string | null;
  authors: string[];
  year: number | null;
  provider: Source["provider"];
  snippet: string | null;
}

/** The only place Source objects are created: cleans and validates every field. */
export function createSource(draft: SourceDraft, retrievedAt: string): Source | null {
  const title = truncate(cleanText(draft.title), 300);
  if (title === "") return null;

  const doi = normalizeDoi(draft.doi);
  const url = safeHttpUrl(draft.url) ?? (doi ? `https://doi.org/${doi}` : null);
  const snippet = truncate(cleanText(draft.snippet), 1200);
  const year =
    draft.year !== null && Number.isInteger(draft.year) && draft.year >= 1000 && draft.year <= 2100
      ? draft.year
      : null;

  return {
    id: makeSourceId(doi, url, title),
    title,
    url,
    doi,
    authors: draft.authors
      .map((name) => truncate(cleanText(name), 100))
      .filter((name) => name !== "")
      .slice(0, 10),
    year,
    provider: draft.provider,
    snippet: snippet === "" ? null : snippet,
    retrievedAt,
    verification: "unverified",
    verificationNote: null,
  };
}
