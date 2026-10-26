import { createHash, timingSafeEqual } from "node:crypto";
import { AppError } from "@/lib/server/errors";
import type { ServerConfig } from "@/lib/server/env";

function safeEqual(a: string, b: string): boolean {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

/** Protects test endpoints that spend quota. Usage: ?token=YOUR_ADMIN_TOKEN */
export function requireAdmin(url: URL, config: ServerConfig): void {
  if (!config.adminToken) {
    throw new AppError(
      "admin_disabled",
      "Set ADMIN_TOKEN in Netlify environment variables (and redeploy) to enable this endpoint.",
      403
    );
  }
  const token = url.searchParams.get("token") ?? "";
  if (!safeEqual(token, config.adminToken)) {
    throw new AppError("forbidden", "Invalid token.", 403);
  }
}

/**
 * Protects the research API. ADMIN_TOKEN doubles as the app's access code.
 * The app sends it in the "x-access-code" header.
 */
export function requireAccess(request: Request, config: ServerConfig): void {
  if (!config.adminToken) {
    throw new AppError(
      "access_not_configured",
      "Set ADMIN_TOKEN in Netlify environment variables (and redeploy). It is also your access code for the app.",
      503
    );
  }
  const url = new URL(request.url);
  const supplied = request.headers.get("x-access-code") ?? url.searchParams.get("token") ?? "";
  if (!safeEqual(supplied, config.adminToken)) {
    throw new AppError("unauthorized", "The access code is missing or incorrect.", 401);
  }
}
