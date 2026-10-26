import { handleError, jsonOk } from "@/lib/server/http";
import { getProject } from "@/lib/server/storage/projectStore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const project = await getProject(params.id);
    return jsonOk({ project });
  } catch (error) {
    return handleError(error);
  }
}
