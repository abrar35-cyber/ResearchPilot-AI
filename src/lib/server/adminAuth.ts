
import { createHash, timingSafeEqual } from "node:crypto";
import { AppError } from "@/lib/server/errors";
import type { ServerConfig } from "@/lib/server/env";

function safeEqual(a: string, b: string): boolean {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

/**
 * Protects owner-only test endpoints.
 * The admin token must be sent in the Authorization header:
 * Authorization: Bearer YOUR_ADMIN_TOKEN
 *
 * If ADMIN_TOKEN is not configured, these endpoints stay disabled.
 */
export function requireAdmin(
  request: Request,
  config: ServerConfig
): void {
  if (!config.adminToken) {
    throw new AppError(
      "admin_disabled",
      "This owner-only test endpoint is disabled (ADMIN_TOKEN is not set).",
      403
    );
  }

  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim() ?? "";

  if (!token || !safeEqual(token, config.adminToken)) {
    throw new AppError("forbidden", "Invalid or missing admin token.", 403);
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
    throw new AppError(
      "invalid_visitor",
      "Missing or invalid visitor id. Reload the page and try again.",
      400
    );
  }

  return id;
}
