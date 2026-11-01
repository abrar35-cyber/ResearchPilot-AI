
import { getConfig } from "@/lib/server/env";
import { handleError, jsonOk } from "@/lib/server/http";
import { requireVisitor } from "@/lib/server/adminAuth";
import { NotFoundError } from "@/lib/server/errors";
import { runNextStep } from "@/lib/server/orchestrator";
import { getProject } from "@/lib/server/storage/projectStore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/projects/{id}/run
// Runs the next single research step.
// POST with {"resume": true} retries after a provider problem.
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ownerId = requireVisitor(request);
    const config = getConfig();

    let resume = false;

    try {
      const body: unknown = await request.json();

      resume =
        typeof body === "object" &&
        body !== null &&
        (body as { resume?: unknown }).resume === true;
    } catch {
      // An empty body is allowed.
    }

    const project = await getProject(params.id);

    // Only the project owner can execute its research workflow.
    if (project.ownerId !== ownerId) {
      throw new NotFoundError("Project");
    }

    const updated = await runNextStep(project, config, { resume });

    return jsonOk({
      project: updated,
      done:
        updated.status === "completed" ||
        updated.status === "stopped" ||
        updated.status === "failed",
    });
  } catch (error) {
    return handleError(error);
  }
}
