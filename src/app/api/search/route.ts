import { AppError } from "@/lib/server/errors";
import { getConfig } from "@/lib/server/env";
import { requireAdmin } from "@/lib/server/adminAuth";
import { discoverSources } from "@/lib/server/search/discover";
import { handleError, jsonOk } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Test endpoint: /api/search?q=groundwater+depletion+Sindh&token=YOUR_ADMIN_TOKEN
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const config = getConfig();
    requireAdmin(url, config);

    const query = (url.searchParams.get("q") ?? "").trim();
    if (query.length < 3 || query.length > 200) {
      throw new AppError("invalid_query", "Use ?q= with 3 to 200 characters.", 400);
    }

    const result = await discoverSources([query], config, { maxSources: 10 });
    return jsonOk(result);
  } catch (error) {
    return handleError(error);
  }
}
