"use client";

import { History } from "lucide-react";
import { useApp } from "@/components/providers/AppProvider";

export function HistoryList() {
  const { t } = useApp();

  return (
    <section id="history" className="card scroll-mt-20">
      <h2 className="mb-4 text-base font-semibold">{t.history.title}</h2>
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center dark:border-slate-700">
        <History className="h-8 w-8 text-slate-400" aria-hidden />
        <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">
          {t.history.empty}
        </p>
      </div>
    </section>
  );
}
