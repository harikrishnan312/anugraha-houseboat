import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { badRequest, jsonError } from "@/lib/http";
import { requireApiAccess } from "@/lib/api-access";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  const denied = requireApiAccess(request); if (denied) return denied;
  try {
    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) return badRequest("Invalid booking ID");
    await connectDB();
    const booking = await Booking.findOneAndUpdate(
      { _id: id, status: "confirmed" },
      { $set: { status: "cancelled" } },
      { new: true }
    );
    if (!booking) return badRequest("Booking not found or already cancelled", 404);
    return NextResponse.json({ success: true, data: booking, message: "Booking cancelled; rooms are released." });
  } catch (e) { return jsonError(e); }
}
