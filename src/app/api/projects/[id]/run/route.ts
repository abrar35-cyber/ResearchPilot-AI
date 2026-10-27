import { getConfig } from "@/lib/server/env";
import { handleError, jsonOk } from "@/lib/server/http";
import { runNextStep } from "@/lib/server/orchestrator";
import { getProject } from "@/lib/server/storage/projectStore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/projects/{id}/run          → runs the next single step
// POST with body {"resume": true}      → retries after a provider problem
// Each project has its own hard budget (calls, tokens, time), so this cannot run forever.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const config = getConfig();

    let resume = false;
    try {
      const body: unknown = await request.json();
      resume = typeof body === "object" && body !== null && (body as { resume?: unknown }).resume === true;
    } catch {
      // An empty body is fine.
    }

    const project = await getProject(params.id);
    const updated = await runNextStep(project, config, { resume });

    return jsonOk({
      project: updated,
      done: updated.status === "completed" || updated.status === "stopped" || updated.status === "failed",
    });
  } catch (error) {
    return handleError(error);
  }
}
