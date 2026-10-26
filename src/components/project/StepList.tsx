"use client";

import { CircleCheck, Circle, CircleMinus, CircleX, LoaderCircle } from "lucide-react";
import { AGENT_META } from "@/components/agents/agentMeta";
import { useApp } from "@/components/providers/AppProvider";
import type { AgentName, Project, StepRecord } from "@/lib/schemas/research";

type StepStatus = StepRecord["status"];

function StatusIcon({ status, label }: { status: StepStatus; label: string }) {
  const common = "h-5 w-5 shrink-0";
  switch (status) {
    case "running":
      return <LoaderCircle className={`${common} animate-spin text-brand-600`} aria-label={label} />;
    case "done":
      return <CircleCheck className={`${common} text-emerald-600`} aria-label={label} />;
    case "failed":
      return <CircleX className={`${common} text-red-600`} aria-label={label} />;
    case "skipped":
      return <CircleMinus className={`${common} text-slate-400`} aria-label={label} />;
    default:
      return <Circle className={`${common} text-slate-300 dark:text-slate-600`} aria-label={label} />;
  }
}

export function StepList({
  project,
  activeAgent,
}: {
  project: Project;
  activeAgent: AgentName | null;
}) {
  const { t } = useApp();

  return (
    <section className="card">
      <h2 className="mb-4 text-base font-semibold">{t.project.progress}</h2>
      <ol className="space-y-3">
        {AGENT_META.map(({ key, name, Icon }) => {
          const step = project.steps.find((s) => s.agent === key);
          // A stored "running" state only counts while this page is really running that step.
          const stored: StepStatus = step?.status === "running" ? "pending" : (step?.status ?? "pending");
          const status: StepStatus = activeAgent === key ? "running" : stored;

          return (
            <li key={key} className="flex items-start gap-3">
              <StatusIcon status={status} label={t.steps[status]} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-medium" dir="ltr">
                  <Icon className="h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden />
                  {name}
                  <span className="text-xs font-normal text-slate-500 dark:text-slate-400" dir="auto">
                    · {t.steps[status]}
                  </span>
                </div>
                {step?.note && status !== "running" && (
                  <p dir="auto" className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {step.note}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
