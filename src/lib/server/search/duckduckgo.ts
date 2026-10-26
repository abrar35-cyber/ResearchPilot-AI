import { z } from "zod";
import type { Source } from "@/lib/schemas/research";
import type { ServerConfig } from "@/lib/server/env";
import { buildUserAgent, fetchJson, SearchProviderError } from "@/lib/server/search/http";
import { createSource } from "@/lib/server/search/normalize";

const BASE = "https://api.duckduckgo.com/";

const ResponseSchema = z.object({
  Heading: z.string().optional(),
  AbstractText: z.string().optional(),
  AbstractURL: z.string().optional(),
  Results: z.array(z.unknown()).optional(),
  RelatedTopics: z.array(z.unknown()).optional(),
});

const LeafSchema = z.object({ FirstURL: z.string(), Text: z.string() });

interface Leaf {
  url: string;
  text: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// RelatedTopics can contain groups ({ Name, Topics: [...] }), so flatten them.
function collectLeaves(items: unknown[], out: Leaf[]): void {
  for (const item of items) {
    const leaf = LeafSchema.safeParse(item);
    if (leaf.success) {
      out.push({ url: leaf.data.FirstURL, text: leaf.data.Text });
    } else if (isRecord(item) && Array.isArray(item["Topics"])) {
      collectLeaves(item["Topics"], out);
    }
  }
}

/**
 * DuckDuckGo has no official full web-search API. This uses the free Instant
 * Answer API, which only covers topics with an encyclopedia-style entry and
 * often returns nothing for specific questions.
 */
export async function searchDuckDuckGo(
  query: string,
  limit: number,
  config: ServerConfig,
  timeoutMs: number
): Promise<Source[]> {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    no_html: "1",
    skip_disambig: "1",
    t: "researchpilot",
  });

  const data = await fetchJson(`${BASE}?${params.toString()}`, {
    provider: "duckduckgo",
    timeoutMs,
    userAgent: buildUserAgent(config.contactEmail),
  });

  const response = ResponseSchema.safeParse(data);
  if (!response.success) {
    throw new SearchProviderError("duckduckgo", "bad_response", "DuckDuckGo: unexpected response format.");
  }

  const now = new Date().toISOString();
  const sources: Source[] = [];
  const add = (title: string, url: string, snippet: string): void => {
    const source = createSource(
      { title, url, doi: null, authors: [], year: null, provider: "duckduckgo", snippet },
      now
    );
    if (source) sources.push(source);
  };

  const d = response.data;
  if (d.AbstractText && d.AbstractURL) {
    add(d.Heading || query, d.AbstractURL, d.AbstractText);
  }

  const leaves: Leaf[] = [];
  collectLeaves(d.Results ?? [], leaves);
  collectLeaves(d.RelatedTopics ?? [], leaves);

  for (const leaf of leaves) {
    const split = leaf.text.indexOf(" - ");
    const title = split > 0 ? leaf.text.slice(0, split) : leaf.text.slice(0, 100);
    add(title, leaf.url, leaf.text);
  }

  return sources.slice(0, limit);
}
