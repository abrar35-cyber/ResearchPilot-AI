import { getConfig } from "@/lib/server/env";
import { requireAccess } from "@/lib/server/adminAuth";
import { handleError, jsonOk } from "@/lib/server/http";
import { getProject } from "@/lib/server/storage/projectStore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    requireAccess(request, getConfig());
    const project = await getProject(params.id);
    return jsonOk({ project });
  } catch (error) {
    return handleError(error);
  }
}
