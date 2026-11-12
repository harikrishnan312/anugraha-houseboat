import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { badRequest, jsonError } from "@/lib/http";
import { requireApiAccess } from "@/lib/api-access";

export async function GET(request: NextRequest) {
  const denied = requireApiAccess(request); if (denied) return denied;
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from"); const to = searchParams.get("to");
    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return badRequest("Valid from and to dates are required (YYYY-MM-DD)");
    await connectDB();
    const rows = await Booking.aggregate([
      { $match: { status: "confirmed", bookingDate: { $gte: new Date(`${from}T00:00:00.000Z`), $lte: new Date(`${to}T23:59:59.999Z`) } } },
      { $group: { _id: null, bookingCount: { $sum: 1 }, totalAmount: { $sum: "$totalAmount" }, advanceAmount: { $sum: "$advanceAmount" }, balanceAmount: { $sum: "$balanceAmount" } } }
    ]);
    return NextResponse.json({ success: true, data: rows[0] || { bookingCount: 0, totalAmount: 0, advanceAmount: 0, balanceAmount: 0 } });
  } catch (e) { return jsonError(e); }
}
