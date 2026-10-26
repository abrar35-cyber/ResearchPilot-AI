"use client";

import { Moon, Sun } from "lucide-react";
import { useApp } from "@/components/providers/AppProvider";

export function ThemeToggle() {
  const { toggleTheme, t } = useApp();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={t.controls.theme}
      title={t.controls.theme}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      {/* CSS decides which icon shows, so there is no flash on load */}
      <Moon className="h-5 w-5 dark:hidden" aria-hidden />
      <Sun className="hidden h-5 w-5 dark:block" aria-hidden />
    </button>
  );
}
