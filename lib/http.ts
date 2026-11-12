import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function jsonError(error: unknown, fallback = "Something went wrong") {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { success: false, message: "Validation failed", errors: error.issues.map(i => ({ path: i.path.join("."), message: i.message })) },
      { status: 400 }
    );
  }
  console.error(error);
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ success: false, message }, { status: 500 });
}

export function badRequest(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status });
}
