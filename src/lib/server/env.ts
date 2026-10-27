import { BUDGET_DISPLAY_DEFAULTS as DEFAULTS } from "@/lib/constants";
import type { BudgetLimits } from "@/lib/server/budget/budgetManager";

export type ReasoningEffort = "low" | "medium" | "high";

export interface ServerConfig {
  groqApiKey: string | null;
  groqModel: string;
  groqReasoningEffort: ReasoningEffort;
  aiCallTimeoutMs: number;
  budget: BudgetLimits;
  adminToken: string | null;
  openAlexApiKey: string | null;
  contactEmail: string | null;
  blobs: { siteId: string; token: string } | null;
  warnings: string[];
}

function readString(name: string): string | null {
  const raw = process.env[name]?.trim();
  return raw ? raw : null;
}

function readInt(
  name: string,
  fallback: number,
  min: number,
  max: number,
  warnings: string[]
): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    warnings.push(
      `${name}="${raw}" is invalid (expected a whole number from ${min} to ${max}); using ${fallback}.`
    );
    return fallback;
  }
  return value;
}

function readEffort(warnings: string[]): ReasoningEffort {
  const raw = readString("GROQ_REASONING_EFFORT")?.toLowerCase();
  if (!raw) return "medium";
  if (raw === "low" || raw === "medium" || raw === "high") return raw;
  warnings.push(`GROQ_REASONING_EFFORT="${raw}" is invalid (use low, medium or high); using medium.`);
  return "medium";
}

/** Reads and validates environment variables. Never log or return secret values. */
export function getConfig(): ServerConfig {
  const warnings: string[] = [];

  const siteId = readString("BLOBS_SITE_ID");
  const blobsToken = readString("BLOBS_TOKEN");

  return {
    groqApiKey: readString("GROQ_API_KEY"),
    groqModel: readString("GROQ_MODEL") ?? "openai/gpt-oss-120b",
    groqReasoningEffort: readEffort(warnings),
    aiCallTimeoutMs: readInt("AI_CALL_TIMEOUT_MS", 20000, 2000, 28000, warnings),
    budget: {
      maxAiCalls: readInt("BUDGET_MAX_AI_CALLS", DEFAULTS.maxAiCalls, 1, 100, warnings),
      maxTokens: readInt("BUDGET_MAX_TOKENS", DEFAULTS.maxTokens, 1000, 500000, warnings),
      maxSeconds: readInt("BUDGET_MAX_SECONDS", DEFAULTS.maxSeconds, 10, 900, warnings),
      maxRetries: readInt("BUDGET_MAX_RETRIES", DEFAULTS.maxRetries, 0, 5, warnings),
      reportReservePercent: readInt("BUDGET_REPORT_RESERVE_PERCENT", 25, 0, 50, warnings),
    },
    adminToken: readString("ADMIN_TOKEN"),
    openAlexApiKey: readString("OPENALEX_API_KEY"),
    contactEmail: readString("CONTACT_EMAIL"),
    blobs: siteId && blobsToken ? { siteId, token: blobsToken } : null,
    warnings,
  };
}
