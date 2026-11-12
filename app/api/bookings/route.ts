import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { bookingSchema } from "@/lib/validators";
import { createBooking } from "@/lib/booking";
import { jsonError, badRequest } from "@/lib/http";
import { requireApiAccess } from "@/lib/api-access";

export async function GET(request: NextRequest) {
  const denied = requireApiAccess(request); if (denied) return denied;
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const houseboatId = searchParams.get("houseboatId");
    const filter: any = {};
    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return badRequest("date must be YYYY-MM-DD");
      filter.bookingDate = { $gte: new Date(`${date}T00:00:00.000Z`), $lte: new Date(`${date}T23:59:59.999Z`) };
    }
    if (houseboatId) filter.houseboatId = houseboatId;
    const data = await Booking.find(filter).populate("houseboatId", "boatName totalRooms").sort({ createdAt: -1 }).lean();
    return NextResponse.json({ success: true, data });
  } catch (e) { return jsonError(e); }
}

export async function POST(request: NextRequest) {
  const denied = requireApiAccess(request); if (denied) return denied;
  try {
    await connectDB();
    const body = bookingSchema.parse(await request.json());
    const data = await createBooking(body);
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (e: any) {
    if (e?.message?.includes("booking") || e?.message?.includes("room") || e?.message?.includes("Houseboat")) {
      return badRequest(e.message, 409);
    }
    return jsonError(e);
  }
}
