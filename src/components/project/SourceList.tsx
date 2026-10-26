"use client";

import { useApp } from "@/components/providers/AppProvider";
import type { Source } from "@/lib/schemas/research";

const PROVIDER_LABEL: Record<Source["provider"], string> = {
  openalex: "OpenAlex",
  crossref: "Crossref",
  duckduckgo: "DuckDuckGo",
};

function VerificationBadge({ status }: { status: Source["verification"] }) {
  const { t } = useApp();
  const map = {
    verified: {
      label: t.project.verified,
      style: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    },
    failed: {
      label: t.project.failedCheck,
      style: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    },
    unverified: {
      label: t.project.notVerified,
      style: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    },
  } as const;
  const item = map[status];
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${item.style}`}>{item.label}</span>
  );
}

export function SourceList({ sources, maxSources }: { sources: Source[]; maxSources: number }) {
  const { t } = useApp();

  return (
    <section className="card">
      <h2 className="mb-4 text-base font-semibold">
        {t.project.sources}{" "}
        <span className="text-sm font-normal text-slate-500 dark:text-slate-400" dir="ltr">
          ({sources.length} / {maxSources})
        </span>
      </h2>

      {sources.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t.project.sourcesEmpty}</p>
      ) : (
        <ol className="divide-y divide-slate-200 dark:divide-slate-800">
          {sources.map((source, index) => {
            const authors =
              source.authors.length > 3
                ? `${source.authors.slice(0, 3).join(", ")} et al.`
                : source.authors.join(", ");
            return (
              <li key={source.id} className="flex gap-3 py-3">
                <span className="w-6 shrink-0 text-sm tabular-nums text-slate-400" dir="ltr">
                  {index + 1}.
                </span>
                <div className="min-w-0 flex-1">
                  {source.url ? (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      dir="auto"
                      className="break-words text-sm font-medium text-brand-700 underline-offset-2 hover:underline dark:text-brand-300"
                    >
                      {source.title}
                    </a>
                  ) : (
                    <span dir="auto" className="break-words text-sm font-medium">
                      {source.title}
                    </span>
                  )}
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400" dir="auto">
                    {[authors, source.year ? String(source.year) : "", PROVIDER_LABEL[source.provider]]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <div className="mt-1.5">
                    <VerificationBadge status={source.verification} />
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
