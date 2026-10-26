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
