"use client";

import {
  ListChecks,
  Microscope,
  PenLine,
  Scale,
  Search,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { useApp } from "@/components/providers/AppProvider";

const AGENTS = [
  { key: "planner", name: "Planner", Icon: ListChecks },
  { key: "discovery", name: "Discovery", Icon: Search },
  { key: "evidence", name: "Evidence Analyst", Icon: Microscope },
  { key: "critical", name: "Critical Analyst", Icon: Scale },
  { key: "verification", name: "Verification Auditor", Icon: ShieldCheck },
  { key: "writer", name: "Research Writer", Icon: PenLine },
] as const;

export function AgentPipeline() {
  const { t } = useApp();

  return (
    <section className="card">
      <h2 className="text-base font-semibold">{t.agents.title}</h2>
      <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">{t.agents.subtitle}</p>

      <div className="mb-4 flex items-start gap-3 rounded-xl bg-brand-50 p-4 dark:bg-brand-900/30">
        <Workflow className="mt-0.5 h-5 w-5 shrink-0 text-brand-700 dark:text-brand-300" aria-hidden />
        <div>
          <div className="text-sm font-semibold">{t.agents.orchestrator}</div>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {t.agents.orchestratorDesc}
          </p>
        </div>
      </div>

      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {AGENTS.map(({ key, name, Icon }, index) => (
          <li
            key={key}
            className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <Icon className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <div className="text-sm font-semibold" dir="ltr">
                {index + 1}. {name}
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {t.agents.descriptions[key]}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
