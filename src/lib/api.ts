import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  code: string;
  status: number;
  hint?: string;

  constructor(code: string, message: string, status = 400, hint?: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.hint = hint;
  }
}

export function ok(payload: Record<string, unknown> = {}, status = 200) {
  return NextResponse.json({ ok: true, ...payload }, { status });
}

export function errorResponse(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { ok: false, error: { code: err.code, message: err.message, hint: err.hint } },
      { status: err.status },
    );
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "validation_error",
          message: first ? `${first.path.join(".") || "input"}: ${first.message}` : "Invalid input",
          hint: "Check the highlighted field and try again.",
        },
      },
      { status: 400 },
    );
  }
  console.error("[hookmerge] unhandled API error", err);
  const message =
    err instanceof Error && /ENOENT|EACCES|ENOSPC/i.test(err.message)
      ? "Server storage is unavailable. Check the storage directory and permissions."
      : "Something went wrong on our side. Try again in a moment.";
  return NextResponse.json(
    { ok: false, error: { code: "internal_error", message } },
    { status: 500 },
  );
}

type RouteContext = { params: Promise<Record<string, string>> };

export function withRoute(fn: (req: NextRequest, ctx: RouteContext) => Promise<Response>) {
  return async (req: NextRequest, ctx: RouteContext) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export async function readJson<T = unknown>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ApiError("invalid_json", "Request body must be valid JSON", 400);
  }
}
