import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { bookingSchema } from "@/lib/validators";
import { updateBooking } from "@/lib/booking";
import { badRequest, jsonError } from "@/lib/http";
import { requireApiAccess } from "@/lib/api-access";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  const denied = requireApiAccess(request); if (denied) return denied;
  try {
    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) return badRequest("Invalid booking ID");
    await connectDB();
    const body = bookingSchema.parse(await request.json());
    const data = await updateBooking(id, body);
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    if (e?.message?.includes("booking") || e?.message?.includes("room") || e?.message?.includes("Houseboat")) {
      return badRequest(e.message, 409);
    }
    if (e?.message?.includes("not found")) return badRequest(e.message, 404);
    return jsonError(e);
  }
}
