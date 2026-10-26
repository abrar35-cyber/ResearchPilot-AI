"use client";

import { useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import { useApp } from "@/components/providers/AppProvider";

export function AccessCodeCard() {
  const { t, ready, accessCode, setAccessCode } = useApp();
  const [draft, setDraft] = useState("");

  if (!ready) return null;

  function save(event: FormEvent) {
    event.preventDefault();
    if (draft.trim() === "") return;
    setAccessCode(draft);
    setDraft("");
  }

  return (
    <section className="card">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-brand-50 p-2 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
          <KeyRound className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">{t.access.title}</h2>

          {accessCode !== "" ? (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <p className="text-sm text-emerald-700 dark:text-emerald-300">{t.access.saved}</p>
              <button type="button" onClick={() => setAccessCode("")} className="btn-secondary py-1.5">
                {t.access.remove}
              </button>
            </div>
          ) : (
            <form onSubmit={save} className="mt-1">
              <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
                {t.access.description}
              </p>
              <div className="flex flex-wrap gap-2">
                <label className="sr-only" htmlFor="access-code">
                  {t.access.label}
                </label>
                <input
                  id="access-code"
                  type="password"
                  autoComplete="off"
                  dir="ltr"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={t.access.placeholder}
                  className="input min-w-0 flex-1"
                />
                <button type="submit" className="btn-primary">
                  {t.access.save}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
