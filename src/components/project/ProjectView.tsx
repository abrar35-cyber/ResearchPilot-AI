"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pause, Play, RotateCcw, TriangleAlert } from "lucide-react";
import {
  BudgetCard,
  type BudgetLimitsView,
} from "@/components/dashboard/BudgetCard";
import { useApp } from "@/components/providers/AppProvider";
import { ReportView } from "@/components/project/ReportView";
import { SourceList } from "@/components/project/SourceList";
import { StatusBadge } from "@/components/project/StatusBadge";
import { StepList } from "@/components/project/StepList";
import { ApiError, apiRequest, describeError } from "@/lib/client/api";
import { LANGUAGES } from "@/lib/i18n/languages";
import type { AgentName, Project } from "@/lib/schemas/research";

const BUSY_RETRY_LIMIT = 12;
const BUSY_WAIT_MS = 4000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// The live limits come from the public health endpoint (no secrets in it).
function readLimits(data: unknown): BudgetLimitsView | null {
  if (typeof data !== "object" || data === null) return null;
  const config = (data as { config?: unknown }).config;
  if (typeof config !== "object" || config === null) return null;
  const budget = (config as { budget?: unknown }).budget;
  if (typeof budget !== "object" || budget === null) return null;
  const { maxAiCalls, maxTokens, maxSeconds, maxRetries } = budget as Record<string, unknown>;
  if (
    typeof maxAiCalls === "number" &&
    typeof maxTokens === "number" &&
    typeof maxSeconds === "number" &&
    typeof maxRetries === "number"
  ) {
    return { maxAiCalls, maxTokens, maxSeconds, maxRetries };
  }
  return null;
}

function BackLink() {
  const { t } = useApp();
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300"
    >
      <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
      {t.project.back}
    </Link>
  );
}

export function ProjectView({ projectId }: { projectId: string }) {
  const { t, ready, accessCode } = useApp();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [runError, setRunError] = useState<unknown>(null);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [activeAgent, setActiveAgent] = useState<AgentName | null>(null);
  const [limits, setLimits] = useState<BudgetLimitsView | undefined>(undefined);

  const projectRef = useRef<Project | null>(null);
  const runningRef = useRef(false);
  const stopRef = useRef(false);
  const autoRunRef = useRef(false);
  const startedRef = useRef(false);

  // Remember whether we arrived from the "Start research" button (?run=1), then clean the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("run") === "1") {
      autoRunRef.current = true;
      window.history.replaceState(null, "", window.location.pathname);
    }
    return () => {
      stopRef.current = true; // stop the loop if the page is left
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: unknown) => {
        const parsed = readLimits(data);
        if (!cancelled && parsed) setLimits(parsed);
      })
      .catch(() => {
        // keep the default limits
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (accessCode === "") {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    apiRequest<{ project: Project }>(`/api/projects/${projectId}`, accessCode)
      .then((data) => {
        if (cancelled) return;
        projectRef.current = data.project;
        setProject(data.project);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setLoadError(caught);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, accessCode, projectId]);

  // Runs one backend step at a time until the project is finished, paused or an error occurs.
  const runLoop = useCallback(
    async (resume: boolean) => {
      if (runningRef.current) return;
      runningRef.current = true;
      stopRef.current = false;
      setRunning(true);
      setPaused(false);
      setRunError(null);

      let resumeFlag = resume;
      let busyRetries = 0;

      try {
        for (;;) {
          if (stopRef.current) break;
          setActiveAgent(projectRef.current?.nextAgent ?? "planner");

          try {
            const data = await apiRequest<{ project: Project; done: boolean }>(
              `/api/projects/${projectId}/run`,
              accessCode,
              { method: "POST", body: { resume: resumeFlag } }
            );
            resumeFlag = false;
            busyRetries = 0;
            projectRef.current = data.project;
            setProject(data.project);
            if (data.done) break;
          } catch (caught) {
            // A previous step may still hold its short lock (for example after a timeout).
            if (
              caught instanceof ApiError &&
              caught.code === "step_in_progress" &&
              busyRetries < BUSY_RETRY_LIMIT
            ) {
              busyRetries += 1;
              await sleep(BUSY_WAIT_MS);
              continue;
            }
            setRunError(caught);
            break;
          }
        }
      } finally {
        runningRef.current = false;
        setRunning(false);
        setActiveAgent(null);
      }
    },
    [projectId, accessCode]
  );

  // Start automatically when we arrived from the "Start research" button.
  useEffect(() => {
    if (!project || startedRef.current || !autoRunRef.current) return;
    if (project.status === "created" || project.status === "running") {
      startedRef.current = true;
      void runLoop(false);
    }
  }, [project, runLoop]);

  if (!ready || loading) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">{t.project.loading}</p>;
  }

  if (accessCode === "") {
    return (
      <div className="space-y-4">
        <BackLink />
        <section className="card">
          <p className="text-sm">{t.access.missing}</p>
        </section>
      </div>
    );
  }

  if (loadError || !project) {
    return (
      <div className="space-y-4">
        <BackLink />
        <section className="card">
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {describeError(loadError, t)}
          </p>
        </section>
      </div>
    );
  }

  const canContinue = !running && (project.status === "created" || project.status === "running");
  const canRetry = !running && project.status === "stopped" && project.stopReason === "provider_error";

  return (
    <div className="space-y-6">
      <BackLink />

      <section className="card">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.project.question}</p>
            <h1 dir="auto" className="mt-1 break-words text-lg font-semibold sm:text-xl">
              {project.question}
            </h1>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {t.project.sources}:{" "}
              <span dir="ltr">
                {project.sources.length} / {project.maxSources}
              </span>{" "}
              · {t.project.evidence}: <span dir="ltr">{project.evidence.length}</span>
            </p>
          </div>
          <StatusBadge status={project.status} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {canContinue && (
            <button type="button" onClick={() => void runLoop(false)} className="btn-primary">
              <Play className="h-4 w-4 rtl:rotate-180" aria-hidden />
              {project.status === "created" ? t.form.start : t.project.continue}
            </button>
          )}
          {canRetry && (
            <button type="button" onClick={() => void runLoop(true)} className="btn-primary">
              <RotateCcw className="h-4 w-4" aria-hidden />
              {t.project.retry}
            </button>
          )}
          {running && (
            <button
              type="button"
              onClick={() => {
                stopRef.current = true;
                setPaused(true);
              }}
              className="btn-secondary"
            >
              <Pause className="h-4 w-4" aria-hidden />
              {t.project.pause}
            </button>
          )}
          {running && (
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.project.working}</p>
          )}
          {!running && paused && (
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.project.paused}</p>
          )}
        </div>

        {runError !== null && (
          <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
            {describeError(runError, t)}
          </p>
        )}
      </section>

      {project.stopMessage && (
        <section className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/20">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <div>
            <p className="text-sm font-semibold">{t.project.stoppedTitle}</p>
            <p dir="auto" className="mt-0.5 text-sm text-slate-700 dark:text-slate-200">
              {project.stopMessage}
            </p>
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <StepList project={project} activeAgent={activeAgent} />

          <section className="card">
            <h2 className="mb-4 text-base font-semibold">{t.project.report}</h2>
            {project.reportMarkdown ? (
              <ReportView
                markdown={project.reportMarkdown}
                dir={LANGUAGES[project.reportLanguage].dir}
              />
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">{t.project.reportPending}</p>
            )}
          </section>

          <SourceList sources={project.sources} maxSources={project.maxSources} />
        </div>

        <div className="space-y-6">
          <BudgetCard usage={project.usage} limits={limits} />

          <section className="card">
            <h2 className="mb-3 text-base font-semibold">{t.project.limitations}</h2>
            {project.limitations.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t.project.limitationsEmpty}
              </p>
            ) : (
              <ul className="list-disc space-y-1.5 ps-5 text-sm text-slate-700 dark:text-slate-200">
                {project.limitations.map((limitation) => (
                  <li key={limitation} dir="auto">
                    {limitation}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
