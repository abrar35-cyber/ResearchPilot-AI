import type { EvidenceItem, Project, Source } from "@/lib/schemas/research";
import { PROVIDER_LABELS } from "@/lib/server/search/http";
import { REPORT_LABELS, type MethodFacts, type ReportLabels } from "@/lib/server/reports/labels";

/** Gives each cited source a number in order of first appearance. */
export class Numbering {
  private order: string[] = [];

  numberFor(sourceId: string): number {
    let index = this.order.indexOf(sourceId);
    if (index === -1) {
      this.order.push(sourceId);
      index = this.order.length - 1;
    }
    return index + 1;
  }

  get sourceIds(): string[] {
    return [...this.order];
  }
}

export interface ReportParts {
  summary: string | null;
  findings: { heading: string; body: string }[];
  notice: string | null;
}

// Removes brackets so external text can never look like one of our [n] citations.
function plain(text: string): string {
  return text.replace(/[\[\]]/g, "").replace(/\s+/g, " ").trim();
}

function referenceLine(n: number, source: Source, labels: ReportLabels): string {
  const authors =
    source.authors.length > 3
      ? `${source.authors.slice(0, 3).map(plain).join(", ")} et al.`
      : source.authors.map(plain).join(", ");
  const year = source.year ? `(${source.year})` : "";
  const head = [authors, year].filter(Boolean).join(" ");
  const link = source.doi ? `https://doi.org/${source.doi}` : (source.url ?? "");
  const status =
    source.verification === "verified"
      ? labels.verified
      : source.verification === "failed"
        ? labels.failed
        : labels.unverified;
  return `- **[${n}]** ${head ? `${head}. ` : ""}${plain(source.title)}. ${link ? `${link} ` : ""}— ${status}`;
}

function computeFacts(project: Project, citedCount: number): MethodFacts {
  const providers = Array.from(new Set(project.sources.map((s) => PROVIDER_LABELS[s.provider])));
  return {
    date: new Date().toISOString().slice(0, 10),
    queries: project.searchedQueries.length,
    rounds: project.round + 1,
    providers: providers.length > 0 ? providers.join(", ") : "-",
    sourcesCollected: project.sources.length,
    sourcesCited: citedCount,
    evidenceKept: project.evidence.length,
    discarded: project.discardedEvidence + (project.audit?.evidenceRemoved ?? 0),
    verified: project.audit?.verified ?? 0,
    failed: project.audit?.failed ?? 0,
    aiCalls: project.usage.aiCalls,
    tokens: project.usage.tokens,
    seconds: Math.round(project.usage.seconds),
  };
}

/** Evidence-only content (no AI writing): used when the writer cannot run. */
export function buildEvidenceParts(
  project: Project,
  evidence: EvidenceItem[],
  numbering: Numbering,
  notice: string | null
): ReportParts {
  const bySource = new Map<string, EvidenceItem[]>();
  for (const item of evidence) {
    const list = bySource.get(item.sourceId) ?? [];
    list.push(item);
    bySource.set(item.sourceId, list);
  }

  const findings: ReportParts["findings"] = [];
  for (const source of project.sources) {
    const items = bySource.get(source.id);
    if (!items) continue;
    if (findings.length >= 12) break;
    const n = numbering.numberFor(source.id);
    findings.push({
      heading: plain(source.title),
      body: items.map((e) => `- ${plain(e.claim)} [${n}]\n  > “${plain(e.quote)}”`).join("\n"),
    });
  }

  return { summary: null, findings, notice };
}

/** Builds the final Markdown. Methodology, limitations and references come from facts, never from the AI. */
export function buildReportMarkdown(project: Project, parts: ReportParts, numbering: Numbering): string {
  const labels = REPORT_LABELS[project.reportLanguage];
  const sourceById = new Map(project.sources.map((s) => [s.id, s] as const));
  const evidenceById = new Map(project.evidence.map((e) => [e.id, e] as const));
  const lines: string[] = [];

  lines.push(`# ${labels.title}`, "", `**${labels.question}:** ${plain(project.question)}`, "");
  if (parts.notice) lines.push(`> ${parts.notice}`, "");

  if (parts.summary) lines.push(`## ${labels.summary}`, "", parts.summary, "");

  lines.push(`## ${labels.findings}`, "");
  if (parts.findings.length === 0) lines.push(labels.noEvidence, "");
  for (const finding of parts.findings) {
    lines.push(`### ${plain(finding.heading)}`, "", finding.body, "");
  }

  const conflicts = project.critique?.conflicts ?? [];
  if (conflicts.length > 0) {
    lines.push(`## ${labels.conflicts}`, "");
    for (const conflict of conflicts) {
      const ids = Array.from(
        new Set(
          conflict.evidenceIds
            .map((id) => evidenceById.get(id)?.sourceId)
            .filter((id): id is string => Boolean(id))
        )
      );
      const refs = ids.map((id) => `[${numbering.numberFor(id)}]`).join("");
      lines.push(`- ${plain(conflict.text)} ${refs}`.trimEnd());
    }
    lines.push("");
  }

  const cited = numbering.sourceIds;
  const facts = computeFacts(project, cited.length);

  lines.push(`## ${labels.methodology}`, "");
  for (const line of labels.methodLines(facts)) lines.push(`- ${line}`);
  lines.push("");

  const limitations = [
    ...labels.fixedLimitations({ sindhi: project.reportLanguage === "sd" }),
    ...(project.critique?.weaknesses ?? []).map(plain),
    ...(project.critique?.gaps ?? []).map(plain),
    ...project.limitations,
  ];
  lines.push(`## ${labels.limitations}`, "");
  for (const limitation of limitations) lines.push(`- ${limitation}`);
  lines.push("");

  const references = cited
    .map((id, index) => ({ source: sourceById.get(id), n: index + 1 }))
    .filter((entry): entry is { source: Source; n: number } => entry.source !== undefined);
  if (references.length > 0) {
    lines.push(`## ${labels.references}`, "");
    for (const { source, n } of references) lines.push(referenceLine(n, source, labels));
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}

/** A report made only from collected evidence (no AI), used when a run stops early. */
export function buildEvidenceOnlyReport(project: Project): string {
  const labels = REPORT_LABELS[project.reportLanguage];
  const failed = new Set(project.audit?.failedSourceIds ?? []);
  const usable = project.evidence.filter((e) => !failed.has(e.sourceId));
  const numbering = new Numbering();
  const notice = project.stopMessage ? labels.noticeNoAi(project.stopMessage) : null;
  return buildReportMarkdown(project, buildEvidenceParts(project, usable, numbering, notice), numbering);
}
