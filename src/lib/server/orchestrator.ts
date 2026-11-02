
import type {
  AgentName,
  BudgetUsage,
  Project,
  StepRecord,
} from "@/lib/schemas/research";
import { AiProviderError } from "@/lib/server/ai/groqClient";
import { runCriticalAnalyst } from "@/lib/server/agents/criticalAnalyst";
import {
  addLimitations,
  type AgentContext,
  type AgentOutcome,
} from "@/lib/server/agents/context";
import { runDiscovery } from "@/lib/server/agents/discovery";
import { runEvidenceAnalyst } from "@/lib/server/agents/evidenceAnalyst";
import { runPlanner } from "@/lib/server/agents/planner";
import { runResearchWriter } from "@/lib/server/agents/researchWriter";
import { runVerificationAuditor } from "@/lib/server/agents/verificationAuditor";
import {
  BudgetExceededError,
  BudgetManager,
} from "@/lib/server/budget/budgetManager";
import type { ServerConfig } from "@/lib/server/env";
import { buildEvidenceOnlyReport } from "@/lib/server/reports/buildReport";
import { truncate } from "@/lib/server/search/normalize";
import {
  acquireProjectLock,
  assertProjectLock,
  releaseProjectLock,
} from "@/lib/server/storage/projectLock";
import {
  getProject,
  saveProject,
} from "@/lib/server/storage/projectStore";

const RUNNERS: Record<
  AgentName,
  (ctx: AgentContext) => Promise<AgentOutcome>
> = {
  planner: runPlanner,
  discovery: runDiscovery,
  evidence: runEvidenceAnalyst,
  critical: runCriticalAnalyst,
  verification: runVerificationAuditor,
  writer: runResearchWriter,
};

function updateStep(
  project: Project,
  agent: AgentName,
  patch: Partial<StepRecord>
): Project {
  return {
    ...project,
    steps: project.steps.map((step) =>
      step.agent === agent ? { ...step, ...patch } : step
    ),
  };
}

function finishStep(
  project: Project,
  agent: AgentName,
  note: string
): Project {
  const prefix = project.round > 0 ? `Round ${project.round + 1}: ` : "";

  return updateStep(project, agent, {
    status: "done",
    finishedAt: new Date().toISOString(),
    note: truncate(`${prefix}${note}`, 300),
  });
}

// An extra search round is allowed only if the critic found gaps AND enough budget remains
// for roughly one more evidence + critique cycle without touching the report reserve.
function wantsExtraRound(
  project: Project,
  config: ServerConfig,
  usage: BudgetUsage
): boolean {
  const critique = project.critique;

  if (!critique) return false;
  if (project.round >= project.maxExtraRounds) return false;
  if (project.sources.length >= project.maxSources) return false;
  if (critique.gaps.length === 0 || critique.suggestedQueries.length === 0) {
    return false;
  }

  const {
    maxAiCalls,
    maxTokens,
    maxSeconds,
    reportReservePercent,
  } = config.budget;

  const reserve = reportReservePercent / 100;
  const callsLeft =
    maxAiCalls - Math.ceil(maxAiCalls * reserve) - usage.aiCalls;
  const tokensLeft =
    maxTokens - Math.floor(maxTokens * reserve) - usage.tokens;
  const secondsLeft = maxSeconds - usage.seconds;

  return callsLeft >= 4 && tokensLeft >= 12000 && secondsLeft >= 60;
}

/** Decides which agent runs next after a successful step. */
function advance(
  project: Project,
  agent: AgentName,
  config: ServerConfig,
  usage: BudgetUsage
): Project {
  const analysed = new Set(project.analysedSourceIds);
  const unanalysed = project.sources.filter(
    (source) => !analysed.has(source.id)
  ).length;

  const next = (
    nextAgent: AgentName | null,
    patch: Partial<Project> = {}
  ): Project => ({
    ...project,
    nextAgent,
    ...patch,
  });

  switch (agent) {
    case "planner":
      return next("discovery");

    case "discovery":
      if (unanalysed > 0) return next("evidence");

      return next(project.round === 0 ? "writer" : "verification");

    case "evidence":
      if (unanalysed > 0) return next("evidence");

      return next(project.evidence.length > 0 ? "critical" : "writer");

    case "critical":
      if (wantsExtraRound(project, config, usage)) {
        return next("discovery", {
          round: project.round + 1,
        });
      }

      return next("verification");

    case "verification":
      return next("writer");

    case "writer":
      return next(
        project.stopReason === "provider_error" ? "writer" : null,
        {
          status: project.stopReason ? "stopped" : "completed",
        }
      );
  }
}

function handleFailure(
  project: Project,
  agent: AgentName,
  error: unknown
): Project {
  const failedAt = new Date().toISOString();

  const failed = (note: string): Project =>
    updateStep(project, agent, {
      status: "failed",
      finishedAt: failedAt,
      note: truncate(note, 300),
    });

  if (error instanceof BudgetExceededError) {
    const stopped = addLimitations(
      {
        ...failed(error.message),
        stopReason: error.reason,
        stopMessage: error.message,
      },
      [`${error.message} Partial results were kept.`]
    );

    // Out of calls/tokens for work steps: skip ahead to verification and the reserved report.
    const canFinish =
      (error.reason === "ai_calls" || error.reason === "tokens") &&
      agent !== "writer";

    if (canFinish) {
      return {
        ...stopped,
        status: "running",
        nextAgent:
          project.evidence.length > 0 ? "verification" : "writer",
        lockedUntil: null,
      };
    }

    // Time or retries are gone: no more AI. List what was collected and stop.
    return {
      ...stopped,
      status: "stopped",
      nextAgent: null,
      reportMarkdown: buildEvidenceOnlyReport(stopped),
      lockedUntil: null,
    };
  }

  if (error instanceof AiProviderError) {
    return {
      ...failed(error.message),
      status: "stopped",
      stopReason: "provider_error",
      stopMessage: `${error.message} You can try this step again.`,
      nextAgent: agent,
      lockedUntil: null,
    };
  }

  console.error(`Step "${agent}" failed:`, error);

  const crashed: Project = {
    ...failed("Unexpected error."),
    status: "failed",
    stopReason: "error",
    stopMessage: `An unexpected error occurred in the ${agent} step. Partial results were kept.`,
    nextAgent: null,
    lockedUntil: null,
  };

  return {
    ...crashed,
    reportMarkdown:
      crashed.reportMarkdown ??
      (crashed.sources.length > 0
        ? buildEvidenceOnlyReport(crashed)
        : null),
  };
}

/**
 * Runs exactly ONE agent step.
 *
 * A separate atomic lock record prevents concurrent requests from
 * running the same project step at the same time.
 *
 * The latest project is reloaded only after the lock is acquired,
 * avoiding decisions based on stale project data.
 */
export async function runNextStep(
  input: Project,
  config: ServerConfig,
  options: { resume?: boolean } = {}
): Promise<Project> {
  const lock = await acquireProjectLock(input.id);

  try {
    // Always reload after claiming the lock.
    // The route may have passed an outdated project snapshot.
    let project = await getProject(input.id);

    if (
      project.status === "completed" ||
      project.status === "failed" ||
      project.status === "stopped"
    ) {
      const canResume =
        options.resume &&
        project.status === "stopped" &&
        project.stopReason === "provider_error";

      if (!canResume) {
        return project;
      }
    }

    // The user may retry after a provider problem.
    if (
      options.resume &&
      project.status === "stopped" &&
      project.stopReason === "provider_error"
    ) {
      project = {
        ...project,
        status: "running",
        stopReason: null,
        stopMessage: null,
      };
    }

    const agent: AgentName = project.nextAgent ?? "planner";
    const budget = new BudgetManager(config.budget, project.usage);

    // Mark the step as running while this request owns the lock.
    project = updateStep(
      {
        ...project,
        status: "running",
        nextAgent: agent,
        lockedUntil: lock.expiresAt,
      },
      agent,
      {
        status: "running",
        startedAt: new Date().toISOString(),
        finishedAt: null,
        note: null,
      }
    );

    // Confirm ownership immediately before saving the running state.
    await assertProjectLock(lock);
    project = await saveProject(project);

    let result: Project;

    try {
      const outcome = await RUNNERS[agent]({
        project,
        config,
        budget,
      });

      result = advance(
        finishStep(outcome.project, agent, outcome.note),
        agent,
        config,
        budget.snapshot()
      );
    } catch (error) {
      result = handleFailure(project, agent, error);
    }

    // If the lease expired or another request took ownership,
    // do not allow this request to overwrite that request's result.
    await assertProjectLock(lock);

    return await saveProject({
      ...result,
      usage: budget.snapshot(),
      lockedUntil: null,
    });
  } finally {
    // Releases only this request's lock.
    // A newer owner's lock is never intentionally released.
    await releaseProjectLock(lock);
  }
}
