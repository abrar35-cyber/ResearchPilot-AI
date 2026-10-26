import { z } from "zod";
import type { EvidenceItem, Project, StopReason } from "@/lib/schemas/research";
import { BudgetExceededError } from "@/lib/server/budget/budgetManager";
import { AiProviderError, groqChat, parseModelJson } from "@/lib/server/ai/groqClient";
import {
  Numbering,
  buildEvidenceParts,
  buildReportMarkdown,
  type ReportParts,
} from "@/lib/server/reports/buildReport";
import { REPORT_LABELS } from "@/lib/server/reports/labels";
import {
  addLimitations,
  languageInstruction,
  type AgentContext,
  type AgentOutcome,
} from "@/lib/server/agents/context";

const MAX_SOURCES_IN_PROMPT = 25;

const OutputSchema = z.object({
  summary: z.string().default(""),
  findings: z.array(z.object({ heading: z.string(), body: z.string() })).min(1),
});

/**
 * Turns the AI's [S2]-style tags into final [n] numbers. Tags that point to
 * sources that were not provided are removed and counted.
 */
function processCitations(
  text: string,
  refToSource: Map<number, string>,
  numbering: Numbering
): { text: string; removed: number; cited: number } {
  let removed = 0;
  let cited = 0;

  const output = text.replace(/\[\s*(S\d+(?:\s*[,;]\s*S\d+)*)\s*\]/gi, (_match, inner: string) => {
    const numbers = (inner.match(/\d+/g) ?? []).map(Number);
    const valid: number[] = [];
    for (const n of numbers) {
      const sourceId = refToSource.get(n);
      if (sourceId) valid.push(numbering.numberFor(sourceId));
      else removed += 1;
    }
    cited += valid.length;
    return Array.from(new Set(valid))
      .sort((a, b) => a - b)
      .map((n) => `[${n}]`)
      .join("");
  });

  return { text: output.replace(/ {2,}/g, " ").trim(), removed, cited };
}

function evidenceOnlyOutcome(
  project: Project,
  usable: EvidenceItem[],
  reason: string,
  stop: { reason: StopReason; message: string } | null
): AgentOutcome {
  const labels = REPORT_LABELS[project.reportLanguage];
  const withStop: Project =
    stop && !project.stopReason
      ? { ...project, stopReason: stop.reason, stopMessage: stop.message }
      : project;
  const numbering = new Numbering();
  const parts = buildEvidenceParts(withStop, usable, numbering, labels.noticeNoAi(reason));
  return {
    project: { ...withStop, reportMarkdown: buildReportMarkdown(withStop, parts, numbering) },
    note: "The AI writing step did not run; the report lists the evidence only.",
  };
}

export async function runResearchWriter(ctx: AgentContext): Promise<AgentOutcome> {
  const { project, config, budget } = ctx;
  const labels = REPORT_LABELS[project.reportLanguage];

  // Evidence from sources whose citation check failed is not used.
  const failed = new Set(project.audit?.failedSourceIds ?? []);
  const usable = project.evidence.filter((e) => !failed.has(e.sourceId));

  if (usable.length === 0) {
    const numbering = new Numbering();
    const notice = project.stopMessage ? labels.noticeStopped(project.stopMessage) : null;
    const parts = buildEvidenceParts(project, [], numbering, notice);
    return {
      project: { ...project, reportMarkdown: buildReportMarkdown(project, parts, numbering) },
      note: "No usable evidence; the report states this.",
    };
  }

  // Number the sources S1..Sn for the prompt.
  const refToSource = new Map<number, string>();
  const sourceToRef = new Map<string, number>();
  for (const item of usable) {
    if (!sourceToRef.has(item.sourceId) && sourceToRef.size < MAX_SOURCES_IN_PROMPT) {
      const n = sourceToRef.size + 1;
      sourceToRef.set(item.sourceId, n);
      refToSource.set(n, item.sourceId);
    }
  }
  const promptEvidence = usable.filter((e) => sourceToRef.has(e.sourceId));
  const evidenceLines = promptEvidence.map((e) => `[S${sourceToRef.get(e.sourceId)}] ${e.claim}`).join("\n");

  const subQuestions = (project.plan?.subQuestions ?? []).map((q) => `- ${q}`).join("\n");
  const conflicts = (project.critique?.conflicts ?? []).map((c) => `- ${c.text}`).join("\n");
  const gaps = (project.critique?.gaps ?? []).map((g) => `- ${g}`).join("\n");
  const language = languageInstruction(project.reportLanguage);

  try {
    const result = await groqChat(config, budget, {
      purpose: "report",
      json: true,
      maxOutputTokens: 2200,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: [
            `You are the Research Writer. Write a structured research answer in ${language} using ONLY the evidence statements provided.`,
            "Rules:",
            "- Every factual sentence must end with citation tags like [S2] or [S1][S3] naming the evidence that supports it.",
            "- Never cite a source that is not listed. Never invent facts, numbers, names or references.",
            "- If the evidence does not answer a sub-question, say so plainly instead of guessing.",
            "- Do not write a reference list.",
            project.stopMessage
              ? `- The research was stopped early (${project.stopMessage}). State that the conclusions are preliminary.`
              : "",
            'Reply with ONE JSON object: {"summary": string (max 120 words), "findings": [{"heading": string, "body": string}]} with one finding per sub-question (body: 1 to 3 short paragraphs).',
          ]
            .filter(Boolean)
            .join("\n"),
        },
        {
          role: "user",
          content: [
            `Research question: ${project.question}`,
            `Sub-questions:\n${subQuestions}`,
            `Evidence statements (the only facts you may use):\n${evidenceLines}`,
            conflicts ? `Conflicts noted by the critical analyst (mention as uncertainty if relevant):\n${conflicts}` : "",
            gaps ? `Gaps noted:\n${gaps}` : "",
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
    });

    const output = parseModelJson(result.text, OutputSchema);
    const numbering = new Numbering();
    let removed = 0;
    let uncited = 0;

    const summary = processCitations(output.summary, refToSource, numbering);
    removed += summary.removed;

    const findings: ReportParts["findings"] = [];
    for (const finding of output.findings.slice(0, 6)) {
      const processed = processCitations(finding.body, refToSource, numbering);
      removed += processed.removed;
      if (processed.cited === 0) {
        uncited += 1;
        continue;
      }
      findings.push({ heading: finding.heading.trim() || "-", body: processed.text });
    }

    if (findings.length === 0) {
      return evidenceOnlyOutcome(project, usable, "The AI-written text contained no usable citations.", null);
    }

    const notes: string[] = [];
    if (removed > 0) {
      notes.push(`${removed} citation tag(s) written by the AI pointed to sources that were not provided and were removed.`);
    }
    if (uncited > 0) {
      notes.push(`${uncited} AI-written section(s) without any citation were left out.`);
    }
    const withNotes = addLimitations(project, notes);

    const parts: ReportParts = {
      summary: summary.text === "" ? null : summary.text,
      findings,
      notice: withNotes.stopMessage ? labels.noticeStopped(withNotes.stopMessage) : null,
    };

    return {
      project: { ...withNotes, reportMarkdown: buildReportMarkdown(withNotes, parts, numbering) },
      note: `Report written with ${numbering.sourceIds.length} cited sources.`,
    };
  } catch (error) {
    if (error instanceof BudgetExceededError) {
      return evidenceOnlyOutcome(project, usable, error.message, { reason: error.reason, message: error.message });
    }
    if (error instanceof AiProviderError) {
      return evidenceOnlyOutcome(project, usable, error.message, {
        reason: "provider_error",
        message: `${error.message} You can try the writing step again.`,
      });
    }
    throw error;
  }
}
