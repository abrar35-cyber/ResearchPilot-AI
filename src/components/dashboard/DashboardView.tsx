"use client";

import { useApp } from "@/components/providers/AppProvider";
import { ResearchForm } from "@/components/dashboard/ResearchForm";
import { BudgetCard } from "@/components/dashboard/BudgetCard";
import { AgentPipeline } from "@/components/dashboard/AgentPipeline";
import { HistoryList } from "@/components/dashboard/HistoryList";

export function DashboardView() {
  const { t } = useApp();

  return (
    <div className="space-y-8">
      <section id="dashboard" className="scroll-mt-20">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.hero.title}</h1>
        <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">
          {t.hero.subtitle}
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ResearchForm />
        </div>
        <BudgetCard />
      </div>

      <AgentPipeline />
      <HistoryList />

      <p className="pb-4 text-xs text-slate-500 dark:text-slate-400">{t.footer.note}</p>
    </div>
  );
}
