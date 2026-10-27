"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { useApp } from "@/components/providers/AppProvider";
import { ReportView } from "@/components/project/ReportView";
import { apiRequest, describeError } from "@/lib/client/api";
import { reportBaseName } from "@/lib/client/exportReport";
import { EXPORT_TEXT } from "@/lib/i18n/exportText";
import { LANGUAGES } from "@/lib/i18n/languages";
import type { Project } from "@/lib/schemas/research";

// Forces black-on-white for paper, even if the app is in dark mode.
const PRINT_CSS = `
@page { margin: 18mm; }
.print-paper .report, .print-paper .report * { color: #111827 !important; border-color: #9ca3af !important; }
.print-paper .report a { color: #1d4ed8 !important; }
@media print {
  html, body { background: #ffffff !important; }
  .print-paper .report h2, .print-paper .report h3 { break-after: avoid; }
  .print-paper .report blockquote, .print-paper .report li { break-inside: avoid; }
}
`;

export function PrintView({ projectId }: { projectId: string }) {
  const { t, uiLanguage, ready, accessCode } = useApp();
  const text = EXPORT_TEXT[uiLanguage];

  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const autoPrintRef = useRef(false);
  const printedRef = useRef(false);

  useEffect(() => {
    autoPrintRef.current = new URLSearchParams(window.location.search).get("auto") === "1";
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (accessCode === "") {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    apiRequest<{ project: Project }>(`/api/projects/${projectId}`, accessCode)
      .then((data) => {
        if (!cancelled) setProject(data.project);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, accessCode, projectId]);

  // The browser uses the page title as the default PDF file name.
  useEffect(() => {
    if (!project?.reportMarkdown) return;
    document.title = reportBaseName(project.question);
    if (!autoPrintRef.current) return;

    const timer = window.setTimeout(() => {
      if (printedRef.current) return;
      printedRef.current = true;
      const fontsReady: Promise<unknown> = document.fonts ? document.fonts.ready : Promise.resolve();
      void fontsReady.then(() => window.print());
    }, 500);
    return () => window.clearTimeout(timer);
  }, [project]);

  if (!ready || loading) {
    return <p className="p-6 text-sm">{text.loading}</p>;
  }
  if (accessCode === "") {
    return <p className="p-6 text-sm">{t.access.missing}</p>;
  }
  if (error || !project) {
    return (
      <p role="alert" className="p-6 text-sm text-red-600">
        {describeError(error, t)}
      </p>
    );
  }

  return (
    <div className="print-paper min-h-screen bg-white text-black">
      <style>{PRINT_CSS}</style>

      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-4 pt-6 print:hidden">
        <Link
          href={`/project/${project.id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:underline"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
          {text.back}
        </Link>
        <button type="button" onClick={() => window.print()} className="btn-primary">
          <Printer className="h-4 w-4" aria-hidden />
          {text.printButton}
        </button>
        <p className="text-xs text-slate-600">{text.printHint}</p>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {project.reportMarkdown ? (
          <ReportView
            markdown={project.reportMarkdown}
            dir={LANGUAGES[project.reportLanguage].dir}
          />
        ) : (
          <p className="text-sm">{text.noReport}</p>
        )}
      </main>
    </div>
  );
}
