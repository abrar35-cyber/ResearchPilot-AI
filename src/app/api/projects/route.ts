import {
  AGENT_NAMES,
  CreateProjectInputSchema,
  type Project,
  type StepRecord,
} from "@/lib/schemas/research";
import { detectLanguage } from "@/lib/i18n/detectLanguage";
import { AppError } from "@/lib/server/errors";
import { handleError, jsonOk } from "@/lib/server/http";
import {
  listProjectSummaries,
  newProjectId,
  saveProject,
} from "@/lib/server/storage/projectStore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const projects = await listProjectSummaries();
    return jsonOk({ projects });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("invalid_json", "The request body must be valid JSON.", 400);
    }

    const input = CreateProjectInputSchema.parse(body);
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
    };

    const saved = await saveProject(project);
    return jsonOk({ project: saved }, 201);
  } catch (error) {
    return handleError(error);
  }
}
