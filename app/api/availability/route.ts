import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAvailability } from "@/lib/booking";
import { badRequest, jsonError } from "@/lib/http";
import { requireApiAccess } from "@/lib/api-access";

export async function GET(request: NextRequest) {
  const denied = requireApiAccess(request); if (denied) return denied;
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const houseboatId = searchParams.get("houseboatId") || undefined;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return badRequest("A valid date (YYYY-MM-DD) is required");
    await connectDB();
    const data = await getAvailability(date);
    return NextResponse.json({ success: true, data });
  } catch (e) { return jsonError(e); }
}
