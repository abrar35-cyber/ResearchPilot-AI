import { z } from "zod";
import type { Source } from "@/lib/schemas/research";
import type { ServerConfig } from "@/lib/server/env";
import { buildUserAgent, fetchJson, SearchProviderError } from "@/lib/server/search/http";
import { createSource } from "@/lib/server/search/normalize";

const BASE = "https://api.crossref.org/works";
const SELECT = "DOI,title,author,issued,URL,abstract";

const ResponseSchema = z.object({ message: z.object({ items: z.array(z.unknown()) }) });

const ItemSchema = z.object({
  DOI: z.string().optional(),
  URL: z.string().optional(),
  title: z.array(z.string()).optional(),
  abstract: z.string().optional(),
  author: z
    .array(
      z.object({
        given: z.string().optional(),
        family: z.string().optional(),
        name: z.string().optional(),
      })
    )
    .optional(),
  issued: z
    .object({ "date-parts": z.array(z.array(z.number().nullable())).optional() })
    .optional(),
});

export async function searchCrossref(
  query: string,
  limit: number,
  config: ServerConfig,
  timeoutMs: number
): Promise<Source[]> {
  const params = new URLSearchParams({ query, rows: String(limit), select: SELECT });
  if (config.contactEmail) params.set("mailto", config.contactEmail);

  const data = await fetchJson(`${BASE}?${params.toString()}`, {
    provider: "crossref",
    timeoutMs,
    userAgent: buildUserAgent(config.contactEmail),
  });

  const response = ResponseSchema.safeParse(data);
  if (!response.success) {
    throw new SearchProviderError("crossref", "bad_response", "Crossref: unexpected response format.");
  }

  const now = new Date().toISOString();
  const sources: Source[] = [];

  for (const raw of response.data.message.items) {
    const item = ItemSchema.safeParse(raw);
    if (!item.success) continue;
    const c = item.data;

    const source = createSource(
      {
        title: c.title?.[0] ?? "",
        url: c.URL ?? (c.DOI ? `https://doi.org/${c.DOI}` : null),
        doi: c.DOI ?? null,
        authors: (c.author ?? []).map(
          (a) => a.name ?? [a.given, a.family].filter(Boolean).join(" ")
        ),
        year: c.issued?.["date-parts"]?.[0]?.[0] ?? null,
        provider: "crossref",
        snippet: c.abstract ?? null,
      },
      now
    );
    if (source) sources.push(source);
  }

  return sources;
}
