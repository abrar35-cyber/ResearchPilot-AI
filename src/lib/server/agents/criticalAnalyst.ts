import { z } from "zod";
import type { Critique, Finding } from "@/lib/schemas/research";
import { groqChat, parseModelJson } from "@/lib/server/ai/groqClient";
import { truncate } from "@/lib/server/search/normalize";
import { languageInstruction, type AgentContext, type AgentOutcome } from "@/lib/server/agents/context";

const MAX_EVIDENCE_IN_PROMPT = 40;

const FindingOutput = z.object({
  text: z.string(),
  evidenceIds: z.array(z.string()).default([]),
});

const OutputSchema = z.object({
  agreements: z.array(FindingOutput).default([]),
  conflicts: z.array(FindingOutput).default([]),
  weaknesses: z.array(z.string()).default([]),
  gaps: z.array(z.string()).default([]),
  suggestedQueries: z.array(z.string()).default([]),
  confidence: z.enum(["low", "medium", "high"]).catch("low"),
});

export async function runCriticalAnalyst(ctx: AgentContext): Promise<AgentOutcome> {
  const { project, config, budget } = ctx;
  const language = languageInstruction(project.reportLanguage);

  const sourceById = new Map(project.sources.map((s) => [s.id, s] as const));
  const evidence = project.evidence.slice(0, MAX_EVIDENCE_IN_PROMPT);
  const validIds = new Set(evidence.map((e) => e.id));

  const lines = evidence
    .map((e) => {
      const source = sourceById.get(e.sourceId);
      const label = source ? `${truncate(source.title, 60)}${source.year ? `, ${source.year}` : ""}` : "unknown source";
      return `${e.id} | ${label} | ${e.claim}`;
    })
    .join("\n");

  const subQuestions = (project.plan?.subQuestions ?? []).map((q) => `- ${q}`).join("\n");
  const alreadySearched = project.searchedQueries.map((q) => `- ${q}`).join("\n");

  const result = await groqChat(config, budget, {
    purpose: "work",
    json: true,
    maxOutputTokens: 1200,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: [
          "You are the Critical Analyst of a research assistant. You receive evidence statements with ids (format: id | source | statement).",
          "Compare them: find points where sources agree, points where they conflict, weaknesses (few sources, only abstracts, old or one-sided evidence) and gaps (sub-questions without evidence).",
          `Write all text fields in ${language}. Refer to evidence ONLY by the ids given. Do not add facts that are not in the evidence.`,
          "Reply with ONE JSON object with these keys:",
          '- "agreements": [{"text": string, "evidenceIds": [string]}]',
          '- "conflicts": [{"text": string, "evidenceIds": [string]}]',
          '- "weaknesses": [string]',
          '- "gaps": [string]',
          '- "suggestedQueries": up to 3 NEW keyword queries in ENGLISH (3 to 8 words) that would fill the gaps; an empty list if there are no gaps.',
          '- "confidence": "low", "medium" or "high" for how well the evidence answers the question.',
        ].join("\n"),
      },
      {
        role: "user",
        content: `Research question: ${project.question}\nSub-questions:\n${subQuestions}\n\nQueries already searched (do not repeat):\n${alreadySearched}\n\nEvidence:\n${lines}`,
      },
    ],
  });

  const parsed = parseModelJson(result.text, OutputSchema);

  // Keep only findings that point at real evidence ids.
  const cleanFindings = (items: { text: string; evidenceIds: string[] }[]): Finding[] =>
    items
      .map((item) => ({
        text: truncate(item.text.trim(), 400),
        evidenceIds: Array.from(new Set(item.evidenceIds.filter((id) => validIds.has(id)))),
      }))
      .filter((item) => item.text !== "" && item.evidenceIds.length > 0)
      .slice(0, 6);

  const searched = new Set(project.searchedQueries.map((q) => q.toLowerCase()));
  const suggestedQueries = Array.from(
    new Set(parsed.suggestedQueries.map((q) => q.replace(/\s+/g, " ").trim().slice(0, 120)))
  )
    .filter((q) => q.length >= 3 && !searched.has(q.toLowerCase()))
    .slice(0, 3);

  const critique: Critique = {
    agreements: cleanFindings(parsed.agreements),
    conflicts: cleanFindings(parsed.conflicts),
    weaknesses: parsed.weaknesses.map((w) => truncate(w.trim(), 300)).filter(Boolean).slice(0, 5),
    gaps: parsed.gaps.map((g) => truncate(g.trim(), 300)).filter(Boolean).slice(0, 4),
    suggestedQueries,
    confidence: parsed.confidence,
  };

  return {
    project: { ...project, critique },
    note: `${critique.agreements.length} agreements, ${critique.conflicts.length} conflicts, ${critique.gaps.length} gaps (confidence: ${critique.confidence}).`,
  };
}
