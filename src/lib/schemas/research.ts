import { z } from "zod";
import { MAX_QUESTION_LENGTH, RESEARCH_DEFAULTS } from "@/lib/constants";

export const LanguageCodeSchema = z.enum(["en", "ur", "sd", "roman-ur"]);

export const AGENT_NAMES = [
  "planner",
  "discovery",
  "evidence",
  "critical",
  "verification",
  "writer",
] as const;
export const AgentNameSchema = z.enum(AGENT_NAMES);
export type AgentName = z.infer<typeof AgentNameSchema>;

export const ProjectStatusSchema = z.enum(["created", "running", "completed", "stopped", "failed"]);
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

export const StopReasonSchema = z.enum([
  "ai_calls",
  "tokens",
  "time",
  "retries",
  "provider_error",
  "error",
]);
export type StopReason = z.infer<typeof StopReasonSchema>;

export const BudgetUsageSchema = z.object({
  aiCalls: z.number().int().nonnegative(),
  tokens: z.number().int().nonnegative(),
  seconds: z.number().nonnegative(),
  retries: z.number().int().nonnegative(),
});
export type BudgetUsage = z.infer<typeof BudgetUsageSchema>;

export const StepRecordSchema = z.object({
  agent: AgentNameSchema,
  status: z.enum(["pending", "running", "done", "skipped", "failed"]),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  note: z.string().nullable(),
});
export type StepRecord = z.infer<typeof StepRecordSchema>;

// A source is only "verified" when the Verification Auditor actually checked it.
export const SourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string().nullable(),
  doi: z.string().nullable(),
  authors: z.array(z.string()),
  year: z.number().int().nullable(),
  provider: z.enum(["duckduckgo", "openalex", "crossref"]),
  snippet: z.string().nullable(),
  retrievedAt: z.string(),
  verification: z.enum(["unverified", "verified", "failed"]),
  verificationNote: z.string().nullable(),
});
export type Source = z.infer<typeof SourceSchema>;

export const ProjectSchema = z.object({
  id: z.string(),
  question: z.string(),
  questionLanguage: LanguageCodeSchema,
  reportLanguage: LanguageCodeSchema,
  depth: z.literal("standard"),
  maxSources: z.number().int().min(1).max(RESEARCH_DEFAULTS.maxSources),
  maxExtraRounds: z.number().int().min(0).max(RESEARCH_DEFAULTS.maxExtraRounds),
  status: ProjectStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  steps: z.array(StepRecordSchema),
  sources: z.array(SourceSchema),
  limitations: z.array(z.string()),
  usage: BudgetUsageSchema,
  stopReason: StopReasonSchema.nullable(),
  stopMessage: z.string().nullable(),
  reportMarkdown: z.string().nullable(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const ProjectSummarySchema = z.object({
  id: z.string(),
  question: z.string(),
  status: ProjectStatusSchema,
  reportLanguage: LanguageCodeSchema,
  createdAt: z.string(),
  sourceCount: z.number().int().nonnegative(),
});
export type ProjectSummary = z.infer<typeof ProjectSummarySchema>;

export const CreateProjectInputSchema = z.object({
  question: z
    .string()
    .trim()
    .min(10, "The question must be at least 10 characters long.")
    .max(MAX_QUESTION_LENGTH, `The question must be at most ${MAX_QUESTION_LENGTH} characters long.`),
  reportLanguage: LanguageCodeSchema.default("en"),
  maxSources: z
    .number()
    .int()
    .min(1)
    .max(RESEARCH_DEFAULTS.maxSources)
    .default(RESEARCH_DEFAULTS.maxSources),
  maxExtraRounds: z
    .number()
    .int()
    .min(0)
    .max(RESEARCH_DEFAULTS.maxExtraRounds)
    .default(RESEARCH_DEFAULTS.maxExtraRounds),
});
export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;
