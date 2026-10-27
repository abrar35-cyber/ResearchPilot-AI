// Groq's free plan lists about 8,000 tokens per minute for gpt-oss-120b. Staying a
// little under that avoids rate-limit errors. If your Groq console shows a different
// limit, change the first number.
export const PACING_TOKENS_PER_MINUTE = 6500;
// Rough size of the next AI step, used to decide whether to wait.
export const PACING_STEP_ESTIMATE = 3500;

const WINDOW_MS = 60000;

export class TokenPacer {
  private events: { at: number; tokens: number }[] = [];
  private lastTotal: number | null = null;

  /** Call with project.usage.tokens when the run starts and after every step. */
  record(totalTokens: number): void {
    if (this.lastTotal !== null && totalTokens > this.lastTotal) {
      this.events.push({ at: Date.now(), tokens: totalTokens - this.lastTotal });
    }
    this.lastTotal = totalTokens;
  }

  /** Milliseconds to wait before the next AI step (0 = go now). */
  waitMs(): number {
    const now = Date.now();
    this.events = this.events.filter((event) => now - event.at < WINDOW_MS);

    let running = this.events.reduce((sum, event) => sum + event.tokens, 0);
    if (running + PACING_STEP_ESTIMATE <= PACING_TOKENS_PER_MINUTE) return 0;

    for (const event of this.events) {
      running -= event.tokens;
      if (running + PACING_STEP_ESTIMATE <= PACING_TOKENS_PER_MINUTE) {
        return Math.max(0, event.at + WINDOW_MS - now) + 500;
      }
    }
    return WINDOW_MS;
  }
}
