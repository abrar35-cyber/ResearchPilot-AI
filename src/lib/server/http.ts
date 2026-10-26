import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/lib/server/errors";

export function jsonOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function handleError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "invalid_input",
          message: "The request data is not valid.",
          details: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      },
      { status: 400 }
    );
  }

  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status }
    );
  }

  console.error("Unexpected error:", error);
  return NextResponse.json(
    { error: { code: "internal_error", message: "An unexpected error occurred." } },
    { status: 500 }
  );
}
