import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Houseboat } from "@/models/Houseboat";
import { houseboatSchema } from "@/lib/validators";
import { jsonError } from "@/lib/http";
import { requireApiAccess } from "@/lib/api-access";

export async function GET(request: NextRequest) {
  const denied = requireApiAccess(request); if (denied) return denied;
  try {
    await connectDB();
    const data = await Houseboat.find().sort({ createdAt: -1 }).lean();
    return NextResponse.json({ success: true, data });
  } catch (e) { return jsonError(e); }
}

export async function POST(request: NextRequest) {
  const denied = requireApiAccess(request); if (denied) return denied;
  try {
    await connectDB();
    const body = houseboatSchema.parse(await request.json());
    const data = await Houseboat.create(body);
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (e: any) {
    if (e?.code === 11000) return NextResponse.json({ success: false, message: "Houseboat name already exists" }, { status: 409 });
    return jsonError(e);
  }
}
