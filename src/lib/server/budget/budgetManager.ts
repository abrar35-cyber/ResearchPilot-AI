import type { BudgetUsage } from "@/lib/schemas/research";
import { AppError } from "@/lib/server/errors";

export type BudgetPurpose = "work" | "report";
export type BudgetStopReason = "ai_calls" | "tokens" | "time" | "retries";

export interface BudgetLimits {
  maxAiCalls: number;
  maxTokens: number;
  maxSeconds: number;
  maxRetries: number;
  reportReservePercent: number;
}

export class BudgetExceededError extends AppError {
  readonly reason: BudgetStopReason;

  constructor(reason: BudgetStopReason, message: string) {
    super("budget_exceeded", message, 429);
    this.reason = reason;
  }
}

// Rough estimate (also covers Urdu/Sindhi, which use more tokens per character).
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3);
}

/**
 * Tracks usage for ONE research run. A run spans many short requests, so create
 * a new BudgetManager per request from the saved usage, then save snapshot().
 * Limits are hard: every AI request must pass assertCanCallAi() first.
 */
export class BudgetManager {
  private aiCalls: number;
  private tokens: number;
  private retries: number;
  private readonly baseSeconds: number;
  private readonly startedAt = Date.now();
  private readonly limits: BudgetLimits;

  constructor(limits: BudgetLimits, initial?: BudgetUsage) {
    this.limits = limits;
    this.aiCalls = initial?.aiCalls ?? 0;
    this.tokens = initial?.tokens ?? 0;
    this.retries = initial?.retries ?? 0;
    this.baseSeconds = initial?.seconds ?? 0;
  }

  elapsedSeconds(): number {
    return this.baseSeconds + (Date.now() - this.startedAt) / 1000;
  }

  remainingSeconds(): number {
    return Math.max(0, this.limits.maxSeconds - this.elapsedSeconds());
  }

  /** Call BEFORE every AI request. Throws BudgetExceededError if it must not run. */
  assertCanCallAi(estimatedTokens: number, purpose: BudgetPurpose): void {
    const { maxAiCalls, maxTokens, maxSeconds, reportReservePercent } = this.limits;

    if (this.elapsedSeconds() >= maxSeconds) {
      throw new BudgetExceededError("time", `Stopped: the time limit of ${maxSeconds} seconds was reached.`);
    }

    // Work steps may not touch the share reserved for writing the report.
    const reserve = purpose === "report" ? 0 : reportReservePercent / 100;
    const callCeiling = maxAiCalls - Math.ceil(maxAiCalls * reserve);
    const tokenCeiling = maxTokens - Math.floor(maxTokens * reserve);

    if (this.aiCalls + 1 > callCeiling) {
      const reserved = this.aiCalls + 1 <= maxAiCalls;
      throw new BudgetExceededError(
        "ai_calls",
        reserved
          ? "Stopped: the remaining AI calls are reserved for writing the report."
          : `Stopped: the AI call limit of ${maxAiCalls} was reached.`
      );
    }

    if (this.tokens + estimatedTokens > tokenCeiling) {
      const reserved = this.tokens + estimatedTokens <= maxTokens;
      throw new BudgetExceededError(
        "tokens",
        reserved
          ? "Stopped: the remaining tokens are reserved for writing the report."
          : `Stopped: the token limit of ${maxTokens} was reached.`
      );
    }
  }

  /** Record every attempt, including failed ones (use 0 tokens), so quotas are never bypassed. */
  recordAiCall(tokensUsed: number): void {
    this.aiCalls += 1;
    this.tokens += Math.max(0, Math.round(tokensUsed));
  }

  /** Uses up one retry, or throws if the run has none left. */
  consumeRetry(context: string): void {
    if (this.retries >= this.limits.maxRetries) {
      throw new BudgetExceededError(
        "retries",
        `Stopped: the retry limit of ${this.limits.maxRetries} was reached after: ${context}`
      );
    }
    this.retries += 1;
  }

  snapshot(): BudgetUsage {
    return {
      aiCalls: this.aiCalls,
      tokens: this.tokens,
      seconds: Math.round(this.elapsedSeconds() * 10) / 10,
      retries: this.retries,
    };
  }
}
