import { z } from "zod";
import { AppError } from "@/lib/server/errors";
import type { ServerConfig } from "@/lib/server/env";
import {
  estimateTokens,
  type BudgetManager,
  type BudgetPurpose,
} from "@/lib/server/budget/budgetManager";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_RETRY_WAIT_MS = 8000;

export type AiErrorKind =
  | "not_configured"
  | "auth"
  | "rate_limited"
  | "timeout"
  | "network"
  | "bad_response"
  | "http_error";

const STATUS_BY_KIND: Record<AiErrorKind, number> = {
  not_configured: 503,
  auth: 502,
  rate_limited: 429,
  timeout: 504,
  network: 502,
  bad_response: 502,
  http_error: 502,
};

export class AiProviderError extends AppError {
  readonly kind: AiErrorKind;

  constructor(kind: AiErrorKind, message: string) {
    super(`ai_${kind}`, message, STATUS_BY_KIND[kind]);
    this.kind = kind;
  }
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  messages: ChatMessage[];
  purpose: BudgetPurpose;
  maxOutputTokens?: number;
  temperature?: number;
  /** JSON mode. Your prompt must also contain the word "JSON". */
  json?: boolean;
}

export interface ChatResult {
  text: string;
  tokensUsed: number;
  model: string;
}

type Attempt =
  | { ok: true; result: ChatResult }
  | { ok: false; error: AiProviderError; waitMs: number };

const ResponseSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).min(1),
  usage: z.object({ total_tokens: z.number() }).optional(),
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readProviderMessage(response: Response): Promise<string> {
  try {
    const data: unknown = await response.json();
    const parsed = z.object({ error: z.object({ message: z.string() }) }).safeParse(data);
    return parsed.success ? parsed.data.error.message.slice(0, 200) : "";
  } catch {
    return "";
  }
}

async function attemptOnce(
  config: ServerConfig,
  budget: BudgetManager,
  options: ChatOptions,
  maxOutputTokens: number,
  estimate: number
): Promise<Attempt> {
  const timeoutMs = Math.max(1000, Math.min(config.aiCallTimeoutMs, Math.floor(budget.remainingSeconds() * 1000)));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.groqApiKey}`,
      },
      body: JSON.stringify({
        model: config.groqModel,
        messages: options.messages,
        max_completion_tokens: maxOutputTokens,
        temperature: options.temperature ?? 0.2,
        ...(options.json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      budget.recordAiCall(0);
      const detail = await readProviderMessage(response);

      if (response.status === 401 || response.status === 403) {
        throw new AiProviderError(
          "auth",
          "Groq rejected the API key. Check GROQ_API_KEY in Netlify environment variables."
        );
      }

      if (response.status === 429 || response.status >= 500) {
        const retryAfter = Number(response.headers.get("retry-after"));
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, MAX_RETRY_WAIT_MS * 4)
          : 2000;
        const kind: AiErrorKind = response.status === 429 ? "rate_limited" : "http_error";
        return {
          ok: false,
          waitMs,
          error: new AiProviderError(
            kind,
            response.status === 429
              ? "Groq rate limit reached (free-tier quota)."
              : `Groq had a temporary error (HTTP ${response.status}).`
          ),
        };
      }

      throw new AiProviderError("http_error", `Groq returned HTTP ${response.status}. ${detail}`.trim());
    }

    const parsed = ResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      budget.recordAiCall(estimate);
      throw new AiProviderError("bad_response", "Groq returned a response in an unexpected format.");
    }

    const text = parsed.data.choices[0].message.content ?? "";
    const tokensUsed = parsed.data.usage?.total_tokens ?? estimate;
    budget.recordAiCall(tokensUsed);

    if (text.trim() === "") {
      throw new AiProviderError("bad_response", "Groq returned an empty answer.");
    }

    return { ok: true, result: { text, tokensUsed, model: config.groqModel } };
  } catch (error) {
    if (error instanceof AppError) throw error;

    budget.recordAiCall(0);
    const timedOut = error instanceof Error && error.name === "AbortError";
    return {
      ok: false,
      waitMs: 0,
      error: new AiProviderError(
        timedOut ? "timeout" : "network",
        timedOut ? "The AI request timed out." : "Could not reach the AI provider."
      ),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The ONLY function that talks to Groq. It checks the budget before every
 * request (including retries) and counts every attempt.
 */
export async function groqChat(
  config: ServerConfig,
  budget: BudgetManager,
  options: ChatOptions
): Promise<ChatResult> {
  if (!config.groqApiKey) {
    throw new AiProviderError(
      "not_configured",
      "GROQ_API_KEY is not set. Add it in Netlify → Site configuration → Environment variables, then redeploy."
    );
  }

  const maxOutputTokens = options.maxOutputTokens ?? 1024;
  const promptTokens = estimateTokens(options.messages.map((m) => m.content).join("\n"));
  const estimate = promptTokens + maxOutputTokens;

  // Ends because every loop uses one AI call and one retry, both hard-limited.
  for (;;) {
    budget.assertCanCallAi(estimate, options.purpose);

    const attempt = await attemptOnce(config, budget, options, maxOutputTokens, estimate);
    if (attempt.ok) return attempt.result;

    // Do not wait longer than the time that is left.
    if (attempt.waitMs + 1000 >= budget.remainingSeconds() * 1000) throw attempt.error;

    budget.consumeRetry(attempt.error.message);
    if (attempt.waitMs > 0) await sleep(Math.min(attempt.waitMs, MAX_RETRY_WAIT_MS));
  }
}

/** Parses model output that should be JSON and validates its structure. */
export function parseModelJson<T>(text: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>): T {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  let raw: unknown;
  try {
    raw = JSON.parse(cleaned);
  } catch {
    throw new AiProviderError("bad_response", "The AI returned text that is not valid JSON.");
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new AiProviderError("bad_response", "The AI returned JSON in an unexpected structure.");
  }
  return parsed.data;
}
