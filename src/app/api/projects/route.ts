import {
  AGENT_NAMES,
  CreateProjectInputSchema,
  type Project,
  type StepRecord,
} from "@/lib/schemas/research";
import { detectLanguage } from "@/lib/i18n/detectLanguage";
import { requireVisitor } from "@/lib/server/adminAuth";
import { AppError } from "@/lib/server/errors";
import { handleError, jsonOk } from "@/lib/server/http";
import { reserveRun } from "@/lib/server/limits";
import {
  listProjectSummaries,
  newProjectId,
  saveProject,
} from "@/lib/server/storage/projectStore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Lists only the calling visitor's own projects.
export async function GET(request: Request) {
  try {
    const ownerId = requireVisitor(request);
    const projects = await listProjectSummaries(ownerId);
    return jsonOk({ projects });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ownerId = requireVisitor(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("invalid_json", "The request body must be valid JSON.", 400);
    }

    const input = CreateProjectInputSchema.parse(body);

    // Daily limits protect the shared free quotas. Counted only for valid requests.
    await reserveRun(request);

    const detected = detectLanguage(input.question);
    const now = new Date().toISOString();

    const project: Project = {
      id: newProjectId(),
      question: input.question,
      questionLanguage: detected === "unknown" ? "en" : detected,
      reportLanguage: input.reportLanguage,
      depth: "standard",
      maxSources: input.maxSources,
      maxExtraRounds: input.maxExtraRounds,
      status: "created",
      createdAt: now,
      updatedAt: now,
      steps: AGENT_NAMES.map(
        (agent): StepRecord => ({
          agent,
          status: "pending",
          startedAt: null,
          finishedAt: null,
          note: null,
        })
      ),
      sources: [],
      limitations: [],
      usage: { aiCalls: 0, tokens: 0, seconds: 0, retries: 0 },
      stopReason: null,
      stopMessage: null,
      reportMarkdown: null,
      plan: null,
      searchedQueries: [],
      round: 0,
      nextAgent: "planner",
      analysedSourceIds: [],
      evidence: [],
      discardedEvidence: 0,
      critique: null,
      audit: null,
      lockedUntil: null,
      ownerId,
    };

    const saved = await saveProject(project);
    return jsonOk({ project: saved }, 201);
  } catch (error) {
    return handleError(error);
  }
}
