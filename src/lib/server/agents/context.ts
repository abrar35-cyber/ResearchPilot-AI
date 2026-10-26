import type { Project, Source } from "@/lib/schemas/research";
import { LANGUAGES, type LanguageCode } from "@/lib/i18n/languages";
import type { BudgetManager } from "@/lib/server/budget/budgetManager";
import type { ServerConfig } from "@/lib/server/env";
import { normalizeTitle } from "@/lib/server/search/normalize";

export interface AgentContext {
  project: Project;
  config: ServerConfig;
  budget: BudgetManager;
}

/** What an agent returns: the updated project and a short note about what it did. */
export interface AgentOutcome {
  project: Project;
  note: string;
}

export function languageInstruction(code: LanguageCode): string {
  return code === "roman-ur" ? "Roman Urdu (Urdu written in Latin letters)" : LANGUAGES[code].englishName;
}

/** Adds limitation notes to the project, skipping empty and duplicate ones. */
export function addLimitations(project: Project, notes: string[]): Project {
  const existing = new Set(project.limitations);
  const added = Array.from(new Set(notes.map((n) => n.trim()).filter((n) => n !== "" && !existing.has(n))));
  return added.length === 0 ? project : { ...project, limitations: [...project.limitations, ...added] };
}

/** The text an agent reads for a source: the longer of excerpt and snippet. */
export function analysisText(source: Source): string {
  const excerpt = source.excerpt ?? "";
  const snippet = source.snippet ?? "";
  return excerpt.length > snippet.length ? excerpt : snippet;
}

/** All stored text of a source (used to check that quotes really exist). */
export function allText(source: Source): string {
  return [source.snippet, source.excerpt].filter(Boolean).join(" ");
}

/** True when the quote appears word for word (ignoring case and punctuation) in the text. */
export function quoteInText(quote: string, text: string): boolean {
  const q = normalizeTitle(quote);
  return q.length >= 12 && normalizeTitle(text).includes(q);
}
