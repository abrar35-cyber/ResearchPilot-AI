import type { Source } from "@/lib/schemas/research";
import type { ServerConfig } from "@/lib/server/env";
import { lookupDoi } from "@/lib/server/search/crossrefDoi";
import { normalizeTitle } from "@/lib/server/search/normalize";
import { allText, quoteInText, type AgentContext, type AgentOutcome } from "@/lib/server/agents/context";

const CHUNK_SIZE = 5;
const STEP_DEADLINE_MS = 18000;
const LOOKUP_TIMEOUT_MS = 6000;
const MATCH_THRESHOLD = 0.7;

type Check = Pick<Source, "verification" | "verificationNote">;

// Share of the shorter title's words found in the other title (tolerates subtitles).
function titleOverlap(a: string, b: string): number {
  const wordsA = new Set(normalizeTitle(a).split(" ").filter((w) => w.length > 2));
  const wordsB = new Set(normalizeTitle(b).split(" ").filter((w) => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let shared = 0;
  wordsA.forEach((word) => {
    if (wordsB.has(word)) shared += 1;
  });
  return shared / Math.min(wordsA.size, wordsB.size);
}

async function checkSource(source: Source, config: ServerConfig, timeoutMs: number): Promise<Check> {
  if (!source.doi) {
    return {
      verification: "unverified",
      verificationNote: "No DOI: the citation details were not independently checked.",
    };
  }

  try {
    const result = await lookupDoi(source.doi, config, timeoutMs);
    if (!result.found) {
      return { verification: "failed", verificationNote: "The DOI was not found in Crossref." };
    }
    if (!result.title) {
      return {
        verification: "unverified",
        verificationNote: "The DOI exists in Crossref, but no title was available to compare.",
      };
    }
    return titleOverlap(source.title, result.title) >= MATCH_THRESHOLD
      ? {
          verification: "verified",
          verificationNote: "The DOI is registered in Crossref and its title matches this source.",
        }
      : {
          verification: "failed",
          verificationNote: "The DOI exists, but its registered title does not match this source's title.",
        };
  } catch {
    return { verification: "unverified", verificationNote: "The Crossref check could not be completed." };
  }
}

/**
 * Mechanical checks only (no AI): quotes must exist in the source text, and
 * DOIs of cited sources are matched against Crossref. "verified" is used
 * ONLY when the DOI check succeeded.
 */
export async function runVerificationAuditor(ctx: AgentContext): Promise<AgentOutcome> {
  const { project, config, budget } = ctx;
  const byId = new Map(project.sources.map((s) => [s.id, s] as const));

  const validEvidence = project.evidence.filter((item) => {
    const source = byId.get(item.sourceId);
    return source !== undefined && quoteInText(item.quote, allText(source));
  });
  const evidenceRemoved = project.evidence.length - validEvidence.length;

  const citedIds = Array.from(new Set(validEvidence.map((e) => e.sourceId)));
  const results = new Map<string, Check>();
  const deadline = Date.now() + Math.min(STEP_DEADLINE_MS, budget.remainingSeconds() * 1000);

  for (let i = 0; i < citedIds.length; i += CHUNK_SIZE) {
    const chunk = citedIds.slice(i, i + CHUNK_SIZE);
    const timeLeft = deadline - Date.now();

    if (timeLeft < 1500) {
      for (const id of chunk) {
        results.set(id, {
          verification: "unverified",
          verificationNote: "Not checked: the time limit for this step was reached.",
        });
      }
      continue;
    }

    const timeoutMs = Math.min(LOOKUP_TIMEOUT_MS, timeLeft - 500);
    const checked = await Promise.all(
      chunk.map((id) => checkSource(byId.get(id) as Source, config, timeoutMs))
    );
    chunk.forEach((id, index) => results.set(id, checked[index]));
  }

  const sources = project.sources.map((s) => (results.has(s.id) ? { ...s, ...results.get(s.id) } : s));
  const citedSources = sources.filter((s) => results.has(s.id));

  const verified = citedSources.filter((s) => s.verification === "verified").length;
  const failedSourceIds = citedSources.filter((s) => s.verification === "failed").map((s) => s.id);
  const unverified = citedSources.length - verified - failedSourceIds.length;

  return {
    project: {
      ...project,
      sources,
      evidence: validEvidence,
      audit: {
        checkedAt: new Date().toISOString(),
        sourcesChecked: citedSources.length,
        verified,
        failed: failedSourceIds.length,
        unverified,
        evidenceChecked: project.evidence.length,
        evidenceRemoved,
        failedSourceIds,
      },
    },
    note: `${citedSources.length} cited sources checked: ${verified} verified, ${failedSourceIds.length} failed, ${unverified} not verified; ${evidenceRemoved} evidence items removed.`,
  };
}
