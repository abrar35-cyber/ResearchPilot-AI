"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { History } from "lucide-react";
import { StatusBadge } from "@/components/project/StatusBadge";
import { useApp } from "@/components/providers/AppProvider";
import { apiRequest, describeError } from "@/lib/client/api";
import type { ProjectSummary } from "@/lib/schemas/research";

export function HistoryList() {
  const { t, ready, accessCode } = useApp();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!ready || accessCode === "") {
      setProjects(null);
      return;
    }
    let cancelled = false;
    setError(null);
    apiRequest<{ projects: ProjectSummary[] }>("/api/projects", accessCode)
      .then((data) => {
        if (!cancelled) setProjects(data.projects);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, accessCode]);

  let content;
  if (!ready) {
    content = null;
  } else if (accessCode === "") {
    content = <p className="text-sm text-slate-500 dark:text-slate-400">{t.history.needAccess}</p>;
  } else if (error) {
    content = (
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">
        {describeError(error, t)}
      </p>
    );
  } else if (projects === null) {
    content = <p className="text-sm text-slate-500 dark:text-slate-400">{t.history.loading}</p>;
  } else if (projects.length === 0) {
    content = (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center dark:border-slate-700">
        <History className="h-8 w-8 text-slate-400" aria-hidden />
        <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">{t.history.empty}</p>
      </div>
    );
  } else {
    content = (
      <ul className="divide-y divide-slate-200 dark:divide-slate-800">
        {projects.map((project) => (
          <li key={project.id}>
            <Link
              href={`/project/${project.id}`}
              className="flex items-start justify-between gap-3 rounded-lg px-2 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              <div className="min-w-0">
                <p dir="auto" className="line-clamp-2 text-sm font-medium">
                  {project.question}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {new Date(project.createdAt).toLocaleDateString()} · {project.sourceCount}{" "}
                  {t.history.sources}
                </p>
              </div>
              <StatusBadge status={project.status} />
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section id="history" className="card scroll-mt-20">
      <h2 className="mb-4 text-base font-semibold">{t.history.title}</h2>
      {content}
    </section>
  );
}
