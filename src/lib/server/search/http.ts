import { AppError } from "@/lib/server/errors";
import type { Source } from "@/lib/schemas/research";

export type SearchProvider = Source["provider"];

export const PROVIDER_LABELS: Record<SearchProvider, string> = {
  duckduckgo: "DuckDuckGo",
  openalex: "OpenAlex",
  crossref: "Crossref",
};

export type SearchErrorKind =
  | "not_configured"
  | "rate_limited"
  | "auth"
  | "timeout"
  | "network"
  | "http_error"
  | "bad_response";

export class SearchProviderError extends AppError {
  readonly provider: SearchProvider;
  readonly kind: SearchErrorKind;

  constructor(provider: SearchProvider, kind: SearchErrorKind, message: string) {
    super(`search_${kind}`, message, 502);
    this.provider = provider;
    this.kind = kind;
  }
}

export function buildUserAgent(contactEmail: string | null): string {
  return contactEmail ? `ResearchPilotAI/2.0 (mailto:${contactEmail})` : "ResearchPilotAI/2.0";
}

interface FetchJsonOptions {
  provider: SearchProvider;
  timeoutMs: number;
  userAgent: string;
}

/**
 * GET + parse JSON with a timeout. Error messages never include the URL,
 * because URLs may contain an API key.
 */
export async function fetchJson(url: string, options: FetchJsonOptions): Promise<unknown> {
  const { provider } = options;
  const label = PROVIDER_LABELS[provider];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": options.userAgent },
      signal: controller.signal,
      cache: "no-store",
    });

    if (response.status === 429) {
      throw new SearchProviderError(provider, "rate_limited", `${label}: rate limit reached.`);
    }
    if (response.status === 401 || response.status === 403) {
      throw new SearchProviderError(provider, "auth", `${label}: access denied. Check the API key.`);
    }
    if (!response.ok) {
      throw new SearchProviderError(provider, "http_error", `${label}: HTTP error ${response.status}.`);
    }

    try {
      return await response.json();
    } catch {
      throw new SearchProviderError(provider, "bad_response", `${label}: returned no usable data.`);
    }
  } catch (error) {
    if (error instanceof SearchProviderError) throw error;
    const timedOut = error instanceof Error && error.name === "AbortError";
    throw new SearchProviderError(
      provider,
      timedOut ? "timeout" : "network",
      timedOut ? `${label}: request timed out.` : `${label}: could not be reached.`
    );
  } finally {
    clearTimeout(timer);
  }
}
