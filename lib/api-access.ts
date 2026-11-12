import { NextRequest, NextResponse } from "next/server";

/**
 * Security guard for the starter project.
 * Development is convenient by default. Production API access is denied until
 * an authentication/session layer is connected. Do not set the bypass to true
 * on a public production deployment.
 */
export function requireApiAccess(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") return null;
  if (process.env.ALLOW_UNAUTHENTICATED_API === "true") return null;
  return NextResponse.json(
    { success: false, message: "API access is disabled until authentication is configured." },
    { status: 401 }
  );
}
