
import { handleError, jsonOk } from "@/lib/server/http";
import { requireVisitor } from "@/lib/server/adminAuth";
import { NotFoundError } from "@/lib/server/errors";
import { getProject } from "@/lib/server/storage/projectStore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Visitors can only retrieve their own projects.
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ownerId = requireVisitor(request);
    const project = await getProject(params.id);

    // Do not reveal whether another visitor's project exists.
    if (project.ownerId !== ownerId) {
      throw new NotFoundError("Project");
    }

    return jsonOk({ project });
  } catch (error) {
    return handleError(error);
  }
}
