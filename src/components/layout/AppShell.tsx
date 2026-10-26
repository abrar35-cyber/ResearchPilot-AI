"use client";

import { useState, type ReactNode } from "react";
import { Compass, FilePlus2, History, LayoutDashboard, Menu, X } from "lucide-react";
import { useApp } from "@/components/providers/AppProvider";
import { ThemeToggle } from "@/components/controls/ThemeToggle";
import { LanguageSelect } from "@/components/controls/LanguageSelect";

export function AppShell({ children }: { children: ReactNode }) {
  const { t, uiLanguage, setUiLanguage } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    { href: "#dashboard", label: t.nav.dashboard, Icon: LayoutDashboard },
    { href: "#new", label: t.nav.newResearch, Icon: FilePlus2 },
    { href: "#history", label: t.nav.history, Icon: History },
  ];

  const brand = (
    <div className="flex items-center gap-3 px-5 py-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
        <Compass className="h-5 w-5" aria-hidden />
      </div>
      <div className="leading-tight">
        <div className="text-sm font-bold" dir="ltr">
          {t.appName}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">V2</div>
      </div>
    </div>
  );

  const nav = (
    <nav className="flex flex-col gap-1 px-3 pb-4">
      {links.map(({ href, label, Icon }) => (
        <a
          key={href}
          href={href}
          onClick={() => setMenuOpen(false)}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Icon className="h-5 w-5" aria-hidden />
          {label}
        </a>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 border-e border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:block">
        {brand}
        {nav}
      </aside>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-slate-900/50"
            onClick={() => setMenuOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 start-0 w-64 bg-white shadow-xl dark:bg-slate-900">
            <div className="flex items-center justify-between pe-3">
              {brand}
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label={t.nav.close}
                className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      )}

      <div className="md:ps-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 sm:px-6">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label={t.nav.menu}
            className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>
          <div className="flex-1 truncate text-sm font-semibold md:hidden" dir="ltr">
            {t.appName}
          </div>
          <div className="hidden flex-1 truncate text-sm text-slate-500 dark:text-slate-400 md:block">
            {t.tagline}
          </div>
          <LanguageSelect
            label={t.controls.uiLanguage}
            value={uiLanguage}
            onChange={setUiLanguage}
          />
          <ThemeToggle />
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
