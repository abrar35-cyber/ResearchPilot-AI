import { getConfig } from "@/lib/server/env";
import { requireAdmin } from "@/lib/server/adminAuth";
import { extractPage } from "@/lib/server/search/extractPage";
import { handleError, jsonOk } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Test endpoint: /api/extract?url=https://en.wikipedia.org/wiki/Groundwater&token=YOUR_ADMIN_TOKEN
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    requireAdmin(url, getConfig());

    const { page, fromCache } = await extractPage(url.searchParams.get("url") ?? "");
    return jsonOk({ fromCache, page });
  } catch (error) {
    return handleError(error);
  }
}
