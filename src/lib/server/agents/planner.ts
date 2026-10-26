import { z } from "zod";
import { groqChat, parseModelJson } from "@/lib/server/ai/groqClient";
import { truncate } from "@/lib/server/search/normalize";
import { languageInstruction, type AgentContext, type AgentOutcome } from "@/lib/server/agents/context";

const OutputSchema = z.object({
  scope: z.string().min(1),
  subQuestions: z.array(z.string().min(3)).min(1),
  searchQueries: z.array(z.string().min(3)).min(1),
});

export async function runPlanner(ctx: AgentContext): Promise<AgentOutcome> {
  const { project, config, budget } = ctx;
  const language = languageInstruction(project.reportLanguage);

  const result = await groqChat(config, budget, {
    purpose: "work",
    json: true,
    maxOutputTokens: 700,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: [
          "You are the Planner agent of a research assistant. You do NOT answer the question.",
          "Reply with ONE JSON object with these keys:",
          `- "scope": one sentence describing what will be investigated, written in ${language}.`,
          `- "subQuestions": 3 to 5 specific sub-questions, written in ${language}.`,
          '- "searchQueries": 2 to 4 short keyword queries in ENGLISH (3 to 8 words each) suited to academic databases and web search.',
        ].join("\n"),
      },
      {
        role: "user",
        content: `Research question (may be in English, Urdu, Sindhi or Roman Urdu):\n"""${project.question}"""`,
      },
    ],
  });

  const parsed = parseModelJson(result.text, OutputSchema);

  const searchQueries = Array.from(
    new Set(parsed.searchQueries.map((q) => q.replace(/\s+/g, " ").trim().slice(0, 120)))
  )
    .filter((q) => q.length >= 3)
    .slice(0, 4);

  const plan = {
    scope: truncate(parsed.scope.trim(), 300),
    subQuestions: parsed.subQuestions.map((q) => truncate(q.trim(), 250)).slice(0, 5),
    searchQueries,
  };

  return {
    project: { ...project, plan, searchedQueries: [] },
    note: `Planned ${plan.subQuestions.length} sub-questions and ${plan.searchQueries.length} search queries.`,
  };
}
