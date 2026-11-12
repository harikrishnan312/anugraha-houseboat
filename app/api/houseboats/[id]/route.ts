import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { Houseboat } from "@/models/Houseboat";
import { Booking } from "@/models/Booking";
import { houseboatSchema } from "@/lib/validators";
import { jsonError, badRequest } from "@/lib/http";
import { requireApiAccess } from "@/lib/api-access";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  const denied = requireApiAccess(request); if (denied) return denied;
  try {
    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) return badRequest("Invalid houseboat ID");
    await connectDB();
    const body = houseboatSchema.partial().parse(await request.json());
    const current = await Houseboat.findById(id);
    if (!current) return badRequest("Houseboat not found", 404);
    if (body.totalRooms !== undefined) {
      const active = await Booking.aggregate([
        { $match: { houseboatId: current._id, status: "confirmed" } },
        { $group: { _id: "$bookingDate", rooms: { $sum: "$roomsBooked" } } },
        { $sort: { rooms: -1 } }, { $limit: 1 }
      ]);
      if (active[0] && body.totalRooms < active[0].rooms) return badRequest("Total rooms cannot be less than rooms already booked", 409);
    }
    Object.assign(current, body);
    await current.save();
    return NextResponse.json({ success: true, data: current });
  } catch (e: any) {
    if (e?.code === 11000) return badRequest("Houseboat name already exists", 409);
    return jsonError(e);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  const denied = requireApiAccess(request); if (denied) return denied;
  try {
    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) return badRequest("Invalid houseboat ID");
    await connectDB();
    const boat = await Houseboat.findById(id);
    if (!boat) return badRequest("Houseboat not found", 404);
    const hasBookings = await Booking.exists({ houseboatId: boat._id });
    if (hasBookings) return badRequest("Houseboat has booking history. Mark it inactive instead.", 409);
    await boat.deleteOne();
    return NextResponse.json({ success: true, message: "Houseboat deleted" });
  } catch (e) { return jsonError(e); }
}
