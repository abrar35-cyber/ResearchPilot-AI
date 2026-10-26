import { z } from "zod";
import type { Source } from "@/lib/schemas/research";
import type { ServerConfig } from "@/lib/server/env";
import { buildUserAgent, fetchJson, SearchProviderError } from "@/lib/server/search/http";
import { abstractFromInvertedIndex, createSource } from "@/lib/server/search/normalize";

const BASE = "https://api.openalex.org/works";
const SELECT =
  "id,doi,display_name,title,publication_year,authorships,primary_location,abstract_inverted_index";

const ResponseSchema = z.object({ results: z.array(z.unknown()) });

const WorkSchema = z.object({
  id: z.string().nullable().optional(),
  doi: z.string().nullable().optional(),
  display_name: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  publication_year: z.number().nullable().optional(),
  authorships: z
    .array(
      z.object({
        author: z.object({ display_name: z.string().nullable().optional() }).nullable().optional(),
      })
    )
    .optional(),
  primary_location: z
    .object({ landing_page_url: z.string().nullable().optional() })
    .nullable()
    .optional(),
  abstract_inverted_index: z.record(z.array(z.number())).nullable().optional(),
});

export async function searchOpenAlex(
  query: string,
  limit: number,
  config: ServerConfig,
  timeoutMs: number
): Promise<Source[]> {
  if (!config.openAlexApiKey) {
    throw new SearchProviderError(
      "openalex",
      "not_configured",
      "OpenAlex: skipped because OPENALEX_API_KEY is not set (OpenAlex requires a free API key)."
    );
  }

  const params = new URLSearchParams({
    search: query,
    per_page: String(limit),
    select: SELECT,
    api_key: config.openAlexApiKey,
  });
  if (config.contactEmail) params.set("mailto", config.contactEmail);

  const data = await fetchJson(`${BASE}?${params.toString()}`, {
    provider: "openalex",
    timeoutMs,
    userAgent: buildUserAgent(config.contactEmail),
  });

  const response = ResponseSchema.safeParse(data);
  if (!response.success) {
    throw new SearchProviderError("openalex", "bad_response", "OpenAlex: unexpected response format.");
  }

  const now = new Date().toISOString();
  const sources: Source[] = [];

  for (const item of response.data.results) {
    const work = WorkSchema.safeParse(item);
    if (!work.success) continue;
    const w = work.data;

    const source = createSource(
      {
        title: w.display_name ?? w.title ?? "",
        url: w.primary_location?.landing_page_url ?? w.id ?? null,
        doi: w.doi ?? null,
        authors: (w.authorships ?? []).map((a) => a.author?.display_name ?? ""),
        year: w.publication_year ?? null,
        provider: "openalex",
        snippet: abstractFromInvertedIndex(w.abstract_inverted_index),
      },
      now
    );
    if (source) sources.push(source);
  }

  return sources;
}
