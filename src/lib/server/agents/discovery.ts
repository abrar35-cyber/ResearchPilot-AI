import { AppError } from "@/lib/server/errors";
import { dedupeSources } from "@/lib/server/search/dedupe";
import { discoverSources } from "@/lib/server/search/discover";
import { addLimitations, type AgentContext, type AgentOutcome } from "@/lib/server/agents/context";

export async function runDiscovery(ctx: AgentContext): Promise<AgentOutcome> {
  const { project, config } = ctx;
  if (!project.plan) {
    throw new AppError("missing_plan", "The research plan is missing.", 500);
  }

  // Round 0 uses the planner's queries; extra rounds use the critic's gap queries.
  const wanted = project.round === 0 ? project.plan.searchQueries : (project.critique?.suggestedQueries ?? []);
  const searched = new Set(project.searchedQueries.map((q) => q.toLowerCase()));
  const queries = wanted.filter((q) => !searched.has(q.toLowerCase())).slice(0, 4);

  if (queries.length === 0) {
    return { project, note: "No new search queries to run." };
  }

  const result = await discoverSources(queries, config, { maxSources: project.maxSources });
  const combined = dedupeSources([...project.sources, ...result.sources], project.maxSources);
  const added = combined.sources.length - project.sources.length;

  // "No sources found" is misleading when earlier rounds already found some.
  const notes = result.notes.filter(
    (note) => !(project.sources.length > 0 && note.startsWith("No sources were found"))
  );

  const updated = addLimitations(
    {
      ...project,
      sources: combined.sources,
      searchedQueries: [...project.searchedQueries, ...queries],
    },
    notes
  );

  return {
    project: updated,
    note: `${queries.length} queries, ${added} new sources (${result.stats.duplicatesRemoved} duplicates removed, ${result.stats.cacheHits} cached lookups).`,
  };
}
