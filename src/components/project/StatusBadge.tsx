"use client";

import { useApp } from "@/components/providers/AppProvider";
import type { ProjectStatus } from "@/lib/schemas/research";

const STYLES: Record<ProjectStatus, string> = {
  created: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  running: "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300",
  completed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  stopped: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  failed: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const { t } = useApp();
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STYLES[status]}`}>
      {t.status[status]}
    </span>
  );
}
