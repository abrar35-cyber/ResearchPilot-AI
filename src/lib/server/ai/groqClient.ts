import { z } from "zod";
import { AppError } from "@/lib/server/errors";
import type { ReasoningEffort, ServerConfig } from "@/lib/server/env";
import {
  estimateTokens,
  type BudgetManager,
  type BudgetPurpose,
} from "@/lib/server/budget/budgetManager";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_RETRY_WAIT_MS = 8000;

// Reasoning models (gpt-oss) spend part of max_completion_tokens on thinking
// before they write the answer, so every call gets this extra allowance.
const REASONING_HEADROOM: Record<ReasoningEffort, number> = {
  low: 600,
  medium: 1500,
  high: 3000,
};

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
  /** Size of the visible answer. Thinking room for reasoning models is added automatically. */
  maxOutputTokens?: number;
  temperature?: number;
  /** JSON mode. Your prompt must also contain the word "JSON". */
  json?: boolean;
  /** Overrides GROQ_REASONING_EFFORT for this call (gpt-oss models only). */
  reasoningEffort?: ReasoningEffort;
}

export interface ChatResult {
  text: string;
  tokensUsed: number;
  model: string;
}

type Attempt =
  | { ok: true; result: ChatResult }
  | { ok: false; error: AiProviderError; waitMs: number };

interface RequestSettings {
  maxCompletionTokens: number;
  /** null when the model does not support reasoning_effort. */
  effort: ReasoningEffort | null;
  estimate: number;
}

const ResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string().nullable().optional() }),
        finish_reason: z.string().nullable().optional(),
      })
    )
    .min(1),
  usage: z.object({ total_tokens: z.number() }).optional(),
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function describeWait(seconds: number | null): string {
  if (seconds === null) return "";
  if (seconds >= 120) {
    return ` Try again in about ${Math.ceil(seconds / 60)} minutes (the daily quota may be used up).`;
  }
  return ` Try again in about ${seconds} seconds.`;
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
  settings: RequestSettings
): Promise<Attempt> {
  const timeoutMs = Math.max(
    1000,
    Math.min(config.aiCallTimeoutMs, Math.floor(budget.remainingSeconds() * 1000))
  );
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
        max_completion_tokens: settings.maxCompletionTokens,
        temperature: options.temperature ?? 0.2,
        ...(settings.effort ? { reasoning_effort: settings.effort } : {}),
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

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("retry-after"));
        const seconds = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : null;
        return {
          ok: false,
          waitMs: (seconds ?? 2) * 1000,
          error: new AiProviderError(
            "rate_limited",
            `Groq rate limit reached (free-tier quota).${describeWait(seconds)}`
          ),
        };
      }

      if (response.status >= 500) {
        return {
          ok: false,
          waitMs: 2000,
          error: new AiProviderError(
            "http_error",
            `Groq had a temporary error (HTTP ${response.status}).`
          ),
        };
      }

      throw new AiProviderError("http_error", `Groq returned HTTP ${response.status}. ${detail}`.trim());
    }

    const parsed = ResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      budget.recordAiCall(settings.estimate);
      throw new AiProviderError("bad_response", "Groq returned a response in an unexpected format.");
    }

    const choice = parsed.data.choices[0];
    const text = choice.message.content ?? "";
    const tokensUsed = parsed.data.usage?.total_tokens ?? settings.estimate;
    budget.recordAiCall(tokensUsed);

    if (text.trim() === "") {
      throw new AiProviderError(
        "bad_response",
        choice.finish_reason === "length"
          ? "The AI used all its output tokens while thinking and returned no answer."
          : "Groq returned an empty answer."
      );
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

  const isReasoningModel = /gpt-oss/i.test(config.groqModel);
  const effort = isReasoningModel ? (options.reasoningEffort ?? config.groqReasoningEffort) : null;
  const headroom = effort ? REASONING_HEADROOM[effort] : 0;

  const maxCompletionTokens = (options.maxOutputTokens ?? 1024) + headroom;
  const promptTokens = estimateTokens(options.messages.map((m) => m.content).join("\n"));
  const settings: RequestSettings = {
    maxCompletionTokens,
    effort,
    estimate: promptTokens + maxCompletionTokens,
  };

  // Ends because every loop uses one AI call and one retry, both hard-limited.
  for (;;) {
    budget.assertCanCallAi(settings.estimate, options.purpose);

    const attempt = await attemptOnce(config, budget, options, settings);
    if (attempt.ok) return attempt.result;

    // Long waits (for example a per-minute or daily quota) are reported, not slept through.
    if (attempt.waitMs > MAX_RETRY_WAIT_MS || attempt.waitMs + 1000 >= budget.remainingSeconds() * 1000) {
      throw attempt.error;
    }

    budget.consumeRetry(attempt.error.message);
    if (attempt.waitMs > 0) await sleep(attempt.waitMs);
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
