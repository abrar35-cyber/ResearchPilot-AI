import type { Dictionary } from "@/lib/i18n/translations";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

function readErrorBody(data: unknown): { code?: string; message?: string } | null {
  if (typeof data !== "object" || data === null) return null;
  const error = (data as { error?: unknown }).error;
  if (typeof error !== "object" || error === null) return null;
  const { code, message } = error as { code?: unknown; message?: unknown };
  return {
    code: typeof code === "string" ? code : undefined,
    message: typeof message === "string" ? message : undefined,
  };
}

/** Calls our own API with the access code. Throws ApiError on any problem. */
export async function apiRequest<T>(
  path: string,
  accessCode: string,
  init: { method?: "GET" | "POST"; body?: unknown } = {}
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: init.method ?? "GET",
      headers: { "Content-Type": "application/json", "x-access-code": accessCode },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "network", "Network error");
  }

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    // The body was not JSON (for example a gateway timeout page).
  }

  if (!response.ok) {
    const body = readErrorBody(data);
    throw new ApiError(
      response.status,
      body?.code ?? "http_error",
      body?.message ?? `HTTP ${response.status}`
    );
  }

  return data as T;
}

/** Turns any error into a message in the interface language where possible. */
export function describeError(error: unknown, t: Dictionary): string {
  if (error instanceof ApiError) {
    if (error.code === "unauthorized") return t.errors.unauthorized;
    if (error.code === "network") return t.errors.network;
    if (error.status === 504) return t.errors.stepTimeout;
    return error.message || t.errors.generic;
  }
  return t.errors.generic;
}
