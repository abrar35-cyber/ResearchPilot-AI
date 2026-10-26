"use client";

import { Gauge } from "lucide-react";
import { useApp } from "@/components/providers/AppProvider";
import { BUDGET_DISPLAY_DEFAULTS } from "@/lib/constants";

export interface BudgetUsageView {
  aiCalls: number;
  tokens: number;
  seconds: number;
  retries: number;
}

export interface BudgetLimitsView {
  maxAiCalls: number;
  maxTokens: number;
  maxSeconds: number;
  maxRetries: number;
}

const EMPTY_USAGE: BudgetUsageView = { aiCalls: 0, tokens: 0, seconds: 0, retries: 0 };

function Row({
  label,
  used,
  max,
  suffix,
}: {
  label: string;
  used: number;
  max: number;
  suffix?: string;
}) {
  const percent = Math.min(100, Math.round((used / max) * 100));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-slate-600 dark:text-slate-300">{label}</span>
        <span className="tabular-nums text-slate-500 dark:text-slate-400">
          <span dir="ltr">
            {Math.round(used).toLocaleString("en-US")} / {max.toLocaleString("en-US")}
          </span>
          {suffix ? ` ${suffix}` : ""}
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div
          className="h-full rounded-full bg-brand-500 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function BudgetCard({
  usage = EMPTY_USAGE,
  limits = BUDGET_DISPLAY_DEFAULTS,
}: {
  usage?: BudgetUsageView;
  limits?: BudgetLimitsView;
}) {
  const { t } = useApp();

  return (
    <section className="card">
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-lg bg-brand-50 p-2 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
          <Gauge className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h2 className="text-base font-semibold">{t.budget.title}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t.budget.subtitle}</p>
        </div>
      </div>

      <div className="space-y-4">
        <Row label={t.budget.aiCalls} used={usage.aiCalls} max={limits.maxAiCalls} />
        <Row label={t.budget.tokens} used={usage.tokens} max={limits.maxTokens} />
        <Row
          label={t.budget.time}
          used={usage.seconds}
          max={limits.maxSeconds}
          suffix={t.budget.seconds}
        />
        <Row label={t.budget.retries} used={usage.retries} max={limits.maxRetries} />
      </div>

      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">{t.budget.note}</p>
    </section>
  );
}
