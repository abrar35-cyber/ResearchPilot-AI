
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

/**
 * Conservative upper-bound estimate for text size.
 *
 * UTF-8 byte length is intentionally used instead of character count.
 * This is safer for Urdu, Sindhi, Roman Urdu and other multilingual prompts.
 * A small additional allowance for provider message framing is added by
 * groqClient.ts.
 *
 * This is a safety estimate, not an exact tokenizer.
 */
export function estimateTokens(text: string): number {
  return new TextEncoder().encode(text).length;
}

/**
 * Tracks usage for ONE research run.
 *
 * Every AI request must reserve its maximum estimated usage before it starts.
 * After the provider responds, the reservation is replaced with reported usage.
 */
export class BudgetManager {
  private aiCalls: number;
  private tokens: number;
  private retries: number;

  private reservedCalls = 0;
  private reservedTokens = 0;
  private pendingReservations: number[] = [];

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

  /**
   * Reserve one call and its maximum estimated token usage BEFORE contacting
   * the provider. This also prevents concurrent calls using the same manager
   * from spending the same remaining budget.
   */
  assertCanCallAi(estimatedTokens: number, purpose: BudgetPurpose): void {
    const {
      maxAiCalls,
      maxTokens,
      maxSeconds,
      reportReservePercent,
    } = this.limits;

    const requestedTokens = Math.max(0, Math.ceil(estimatedTokens));

    if (this.elapsedSeconds() >= maxSeconds) {
      throw new BudgetExceededError(
        "time",
        `Stopped: the time limit of ${maxSeconds} seconds was reached.`
      );
    }

    // Work steps cannot consume the budget reserved for the final report.
    const reserve = purpose === "report" ? 0 : reportReservePercent / 100;

    const callCeiling = maxAiCalls - Math.ceil(maxAiCalls * reserve);
    const tokenCeiling = maxTokens - Math.floor(maxTokens * reserve);

    if (this.aiCalls + this.reservedCalls + 1 > callCeiling) {
      const reportReservationAvailable =
        this.aiCalls + this.reservedCalls + 1 <= maxAiCalls;

      throw new BudgetExceededError(
        "ai_calls",
        reportReservationAvailable
          ? "Stopped: the remaining AI calls are reserved for writing the report."
          : `Stopped: the AI call limit of ${maxAiCalls} was reached.`
      );
    }

    if (
      this.tokens + this.reservedTokens + requestedTokens >
      tokenCeiling
    ) {
      const reportReservationAvailable =
        this.tokens + this.reservedTokens + requestedTokens <= maxTokens;

      throw new BudgetExceededError(
        "tokens",
        reportReservationAvailable
          ? "Stopped: the remaining tokens are reserved for writing the report."
          : `Stopped: the token limit of ${maxTokens} was reached.`
      );
    }

    this.reservedCalls += 1;
    this.reservedTokens += requestedTokens;
    this.pendingReservations.push(requestedTokens);
  }

  /**
   * Reconcile one completed attempt with actual provider usage.
   * Failed attempts are also counted as calls.
   */
  recordAiCall(tokensUsed: number): void {
    const reservation = this.pendingReservations.shift();

    if (reservation !== undefined) {
      this.reservedCalls = Math.max(0, this.reservedCalls - 1);
      this.reservedTokens = Math.max(
        0,
        this.reservedTokens - reservation
      );
    }

    this.aiCalls += 1;
    this.tokens += Math.max(0, Math.ceil(tokensUsed));
  }

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
