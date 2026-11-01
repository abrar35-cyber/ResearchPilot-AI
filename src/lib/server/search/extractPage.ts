
import { lookup } from "node:dns/promises";
import { request as httpRequest, type IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { z } from "zod";
import { AppError } from "@/lib/server/errors";
import { cached } from "@/lib/server/storage/cacheStore";
import { cleanText, normalizeUrl, truncate } from "@/lib/server/search/normalize";

const MAX_BYTES = 400000;
const MAX_CHARS = 6000;
const MAX_REDIRECTS = 3;
const DEFAULT_TIMEOUT_MS = 8000;
const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;

export class ExtractError extends AppError {
  constructor(message: string) {
    super("extract_failed", message, 502);
  }
}

export const ExtractedPageSchema = z.object({
  url: z.string(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  text: z.string(),
  truncated: z.boolean(),
  fetchedAt: z.string(),
});

export type ExtractedPage = z.infer<typeof ExtractedPageSchema>;

function isPublicIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);

  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }

  const [a, b, c] = parts;

  if (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113)
  ) {
    return false;
  }

  return true;
}

function ipv6Groups(address: string): number[] | null {
  let value = address.toLowerCase().split("%")[0];

  const ipv4Tail = value.match(/(.*:)(\d+\.\d+\.\d+\.\d+)$/);

  if (ipv4Tail) {
    if (!isPublicIpv4(ipv4Tail[2])) return null;

    const octets = ipv4Tail[2].split(".").map(Number);
    const first = ((octets[0] << 8) | octets[1]).toString(16);
    const second = ((octets[2] << 8) | octets[3]).toString(16);

    value = `${ipv4Tail[1]}${first}:${second}`;
  }

  const halves = value.split("::");

  if (halves.length > 2) return null;

  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1]
    ? halves[1].split(":")
    : [];

  const missing = 8 - left.length - right.length;

  if (
    (halves.length === 1 && missing !== 0) ||
    (halves.length === 2 && missing < 1)
  ) {
    return null;
  }

  const groups = [
    ...left,
    ...Array(missing).fill("0"),
    ...right,
  ].map((part) => {
    if (!/^[0-9a-f]{1,4}$/.test(part)) return -1;
    return Number.parseInt(part, 16);
  });

  if (groups.length !== 8 || groups.some((part) => part < 0)) {
    return null;
  }

  return groups;
}

function isPublicIpv6(address: string): boolean {
  const groups = ipv6Groups(address);
  if (!groups) return false;

  const first = groups[0];
  const second = groups[1];

  // Only allow global unicast space (2000::/3).
  if ((first & 0xe000) !== 0x2000) return false;

  // Reject special-purpose, documentation and transition ranges.
  if (
    (first === 0x2001 && second <= 0x01ff) ||
    (first === 0x2001 && second === 0x0db8) ||
    first === 0x2002 ||
    (first === 0x3fff && (second & 0xf000) === 0)
  ) {
    return false;
  }

  return true;
}

function isPublicAddress(address: string): boolean {
  const version = isIP(address);

  if (version === 4) return isPublicIpv4(address);
  if (version === 6) return isPublicIpv6(address);

  return false;
}

function assertSafeUrl(raw: string): URL {
  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    throw new ExtractError("The URL is not valid.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ExtractError("Only http and https URLs are allowed.");
  }

  if (url.username || url.password) {
    throw new ExtractError("URLs with embedded credentials are not allowed.");
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();

  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    !hostname.includes(".") && isIP(hostname) === 0
  ) {
    throw new ExtractError("This address is not allowed.");
  }

  if (isIP(hostname) && !isPublicAddress(hostname)) {
    throw new ExtractError("This IP address is not publicly routable.");
  }

  return url;
}

/**
 * Resolve the hostname, reject private/non-public answers, and connect
 * directly to one of the validated IPs. This prevents a second DNS
 * resolution during the connection from changing the destination.
 */
async function requestPublicPage(
  url: URL,
  timeoutMs: number
): Promise<IncomingMessage> {
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const version = isIP(hostname);

  let addresses: Array<{ address: string; family: number }>;

  try {
    addresses = version
      ? [{ address: hostname, family: version }]
      : await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new ExtractError("The website hostname could not be resolved.");
  }

  if (
    addresses.length === 0 ||
    addresses.some((item) => !isPublicAddress(item.address))
  ) {
    throw new ExtractError("This website resolves to a non-public network address.");
  }

  const target = addresses[0];
  const transport = url.protocol === "https:" ? httpsRequest : httpRequest;

  return new Promise((resolve, reject) => {
    const request = transport(
      {
        protocol: url.protocol,
        hostname: target.address,
        family: target.family,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        headers: {
          Host: url.host,
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.8",
          "User-Agent": "ResearchPilotAI/2.0",
        },
        ...(url.protocol === "https:"
          ? {
              servername: version ? undefined : hostname,
            }
          : {}),
      },
      resolve
    );

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error("Request timed out."));
    });

    request.once("error", reject);
    request.end();
  });
}

async function readCapped(
  response: IncomingMessage
): Promise<{ text: string; truncated: boolean }> {
  const chunks: Buffer[] = [];
  let received = 0;
  let truncated = false;

  try {
    for await (const chunk of response) {
      const buffer = Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk);

      if (received + buffer.length > MAX_BYTES) {
        const remaining = MAX_BYTES - received;

        if (remaining > 0) {
          chunks.push(buffer.subarray(0, remaining));
        }

        truncated = true;
        response.destroy();
        break;
      }

      chunks.push(buffer);
      received += buffer.length;
    }
  } catch (error) {
    if (!truncated) throw error;
  }

  return {
    text: new TextDecoder("utf-8").decode(Buffer.concat(chunks)),
    truncated,
  };
}

function htmlToPage(
  html: string,
  url: string,
  truncatedByBytes: boolean
): ExtractedPage {
  const title = cleanText(
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
  );

  const description = cleanText(
    html.match(
      /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i
    )?.[1]
  );

  const body = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|nav|footer|header|form)\b[\s\S]*?<\/\1>/gi, " ");

  const text = cleanText(body);

  return {
    url,
    title: title === "" ? null : truncate(title, 300),
    description: description === "" ? null : truncate(description, 500),
    text: truncate(text, MAX_CHARS),
    truncated: truncatedByBytes || text.length > MAX_CHARS,
    fetchedAt: new Date().toISOString(),
  };
}

async function download(
  start: URL,
  timeoutMs: number
): Promise<ExtractedPage> {
  let current = start;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let response: IncomingMessage;

    try {
      response = await requestPublicPage(current, timeoutMs);
    } catch (error) {
      if (error instanceof AppError) throw error;

      const timedOut =
        error instanceof Error &&
        (error.message.toLowerCase().includes("timeout") ||
          error.message.toLowerCase().includes("timed out"));

      throw new ExtractError(
        timedOut
          ? "The page took too long to respond."
          : "The page could not be reached."
      );
    }

    const status = response.statusCode ?? 0;

    if (status >= 300 && status < 400) {
      const location = response.headers.location;
      response.destroy();

      if (!location) {
        throw new ExtractError("The page redirected without a target.");
      }

      current = assertSafeUrl(new URL(location, current).toString());
      continue;
    }

    if (status < 200 || status >= 300) {
      response.destroy();
      throw new ExtractError(`The page returned HTTP ${status}.`);
    }

    const type = response.headers["content-type"] ?? "";

    if (!/text\/html|application\/xhtml|text\/plain/i.test(type)) {
      response.destroy();
      throw new ExtractError(
        "Only web pages and plain text can be read (not PDFs or files)."
      );
    }

    let result: { text: string; truncated: boolean };

    try {
      result = await readCapped(response);
    } catch {
      throw new ExtractError("The page could not be read completely.");
    }

    return htmlToPage(
      result.text,
      current.toString(),
      result.truncated
    );
  }

  throw new ExtractError("The page redirected too many times.");
}

/**
 * Downloads a public web page and returns its readable text (cached 7 days).
 * Extracted page content is untrusted data, never instructions to follow.
 */
export async function extractPage(
  url: string,
  options: { timeoutMs?: number } = {}
): Promise<{ page: ExtractedPage; fromCache: boolean }> {
  const safe = assertSafeUrl(url);

  const { value, fromCache } = await cached({
    namespace: "extract",
    key: normalizeUrl(safe.toString()) ?? safe.toString(),
    ttlSeconds: CACHE_TTL_SECONDS,
    schema: ExtractedPageSchema,
    produce: () =>
      download(safe, options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });

  return { page: value, fromCache };
}
