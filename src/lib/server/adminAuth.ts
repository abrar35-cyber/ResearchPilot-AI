import { createHash, timingSafeEqual } from "node:crypto";
import { AppError } from "@/lib/server/errors";
import type { ServerConfig } from "@/lib/server/env";

function safeEqual(a: string, b: string): boolean {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

/**
 * Optional: protects the owner-only test endpoints (?token=...).
 * If ADMIN_TOKEN is not set, those endpoints stay disabled.
 */
export function requireAdmin(url: URL, config: ServerConfig): void {
  if (!config.adminToken) {
    throw new AppError(
      "admin_disabled",
      "This owner-only test endpoint is disabled (ADMIN_TOKEN is not set).",
      403
    );
  }
  const token = url.searchParams.get("token") ?? "";
  if (!safeEqual(token, config.adminToken)) {
    throw new AppError("forbidden", "Invalid token.", 403);
  }
}

// An anonymous random id created by the browser. It is not a login: it only
// keeps each visitor's history separate.
export const VISITOR_ID_PATTERN = /^[A-Za-z0-9-]{16,64}$/;

export function isValidVisitorId(value: string): boolean {
  return VISITOR_ID_PATTERN.test(value);
}

export function requireVisitor(request: Request): string {
  const id = request.headers.get("x-visitor-id") ?? "";
  if (!isValidVisitorId(id)) {
    throw new AppError("invalid_visitor", "Missing or invalid visitor id. Reload the page and try again.", 400);
  }
  return id;
}
