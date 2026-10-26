"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Rocket } from "lucide-react";
import { useApp } from "@/components/providers/AppProvider";
import { LanguageSelect } from "@/components/controls/LanguageSelect";
import { apiRequest, describeError } from "@/lib/client/api";
import { MAX_QUESTION_LENGTH, MIN_QUESTION_LENGTH, RESEARCH_DEFAULTS } from "@/lib/constants";
import { detectLanguage } from "@/lib/i18n/detectLanguage";
import { LANGUAGES } from "@/lib/i18n/languages";
import type { Project } from "@/lib/schemas/research";

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-sm font-medium tabular-nums">{value}</div>
    </div>
  );
}

export function ResearchForm() {
  const router = useRouter();
  const { t, reportLanguage, setReportLanguage, accessCode } = useApp();
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detected = useMemo(() => detectLanguage(question), [question]);
  const detectedLabel =
    detected === "unknown" ? t.form.unknown : LANGUAGES[detected].label;

  async function start() {
    setError(null);
    const trimmed = question.trim();

    if (accessCode === "") {
      setError(t.access.missing);
      return;
    }
    if (trimmed.length < MIN_QUESTION_LENGTH) {
      setError(t.form.tooShort);
      return;
    }

    setBusy(true);
    try {
      const data = await apiRequest<{ project: Project }>("/api/projects", accessCode, {
        method: "POST",
        body: {
          question: trimmed,
          reportLanguage,
          maxSources: RESEARCH_DEFAULTS.maxSources,
          maxExtraRounds: RESEARCH_DEFAULTS.maxExtraRounds,
        },
      });
      // The project page starts the research automatically because of ?run=1.
      router.push(`/project/${data.project.id}?run=1`);
    } catch (caught) {
      setError(describeError(caught, t));
      setBusy(false);
    }
  }

  return (
    <section id="new" className="card scroll-mt-20">
      <label htmlFor="question" className="mb-2 block text-sm font-semibold">
        {t.form.question}
      </label>
      <textarea
        id="question"
        dir="auto"
        rows={4}
        maxLength={MAX_QUESTION_LENGTH}
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        placeholder={t.form.placeholder}
        className="input w-full resize-y"
      />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span>
          {t.form.detected}:{" "}
          <span className="font-medium text-brand-700 dark:text-brand-300">
            {detectedLabel}
          </span>
        </span>
        <span dir="ltr">
          {question.length} / {MAX_QUESTION_LENGTH}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Chip label={t.form.depth} value={t.form.depthStandard} />
        <Chip label={t.form.maxSources} value={String(RESEARCH_DEFAULTS.maxSources)} />
        <Chip label={t.form.extraRounds} value={String(RESEARCH_DEFAULTS.maxExtraRounds)} />
        <div className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {t.controls.reportLanguage}
          </div>
          <LanguageSelect
            label={t.controls.reportLanguage}
            value={reportLanguage}
            onChange={setReportLanguage}
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={start} disabled={busy} className="btn-primary">
          <Rocket className="h-4 w-4" aria-hidden />
          {busy ? t.form.starting : t.form.start}
        </button>
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
