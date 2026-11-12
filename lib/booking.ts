import mongoose from "mongoose";
import { Booking } from "@/models/Booking";
import { Houseboat } from "@/models/Houseboat";

export type BookingInput = {
  houseboatId: string;
  bookingDate: string;
  bookingType: "sharing" | "individual";
  roomsBooked: number;
  clientName: string;
  mobile: string;
  totalAmount: number;
  advanceAmount: number;
  isAgent: boolean;
  agentName?: string;
  underWhom?: string;
  createdBy?: string;
};

export async function createBooking(input: BookingInput) {
  const session = await mongoose.startSession();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let created: any = null;

  try {
    await session.withTransaction(async () => {
      const boat = await Houseboat.findById(input.houseboatId).session(session);
      if (!boat || boat.status !== "active") throw new Error("Houseboat not found or inactive");

      // This write serializes booking attempts for the same boat inside the transaction.
      // Concurrent transactions touching this same houseboat document conflict and retry.
      await Houseboat.updateOne(
        { _id: boat._id },
        { $inc: { bookingRevision: 1 } },
        { session }
      );

      const dayStart = new Date(`${input.bookingDate}T00:00:00.000Z`);
      const dayEnd = new Date(`${input.bookingDate}T23:59:59.999Z`);
      const existing = await Booking.find({
        houseboatId: boat._id,
        bookingDate: { $gte: dayStart, $lte: dayEnd },
        status: "confirmed"
      }).session(session);

      if (existing.some(b => b.bookingType === "individual")) {
        throw new Error("This houseboat already has an individual booking for the selected date");
      }
      if (input.bookingType === "individual" && existing.length > 0) {
        throw new Error("Individual booking is not allowed because sharing bookings already exist");
      }

      const usedRooms = existing.reduce((sum, b) => sum + b.roomsBooked, 0);
      const rooms = input.bookingType === "individual" ? boat.totalRooms : input.roomsBooked;
      if (input.bookingType === "individual" && input.roomsBooked !== boat.totalRooms) {
        throw new Error(`Individual booking must occupy all ${boat.totalRooms} rooms`);
      }
      if (usedRooms + rooms > boat.totalRooms) {
        throw new Error(`Only ${Math.max(0, boat.totalRooms - usedRooms)} room(s) are available`);
      }

      const [doc] = await Booking.create([{
        ...input,
        bookingDate: dayStart,
        roomsBooked: rooms,
        balanceAmount: input.totalAmount - input.advanceAmount,
        status: "confirmed"
      }], { session });
      created = doc;
    }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
    return created;
  } finally {
    await session.endSession();
  }
}

export async function getAvailability(bookingDate: string, houseboatId?: string) {
  const start = new Date(`${bookingDate}T00:00:00.000Z`);
  const end = new Date(`${bookingDate}T23:59:59.999Z`);
  const boats = await Houseboat.find({ status: "active", ...(houseboatId ? { _id: houseboatId } : {}) }).lean();
  const booked = await Booking.aggregate([
    { $match: { bookingDate: { $gte: start, $lte: end }, status: "confirmed", ...(houseboatId ? { houseboatId: new mongoose.Types.ObjectId(houseboatId) } : {}) } },
    { $group: { _id: "$houseboatId", roomsBooked: { $sum: "$roomsBooked" }, individualCount: { $sum: { $cond: [{ $eq: ["$bookingType", "individual"] }, 1, 0] } }, sharingCount: { $sum: { $cond: [{ $eq: ["$bookingType", "sharing"] }, 1, 0] } } } }
  ]);
  const map = new Map(booked.map(x => [String(x._id), x]));
  return boats.map(boat => {
    const row = map.get(String(boat._id));
    const isIndividual = (row?.individualCount ?? 0) > 0;
    const used = isIndividual ? boat.totalRooms : (row?.roomsBooked ?? 0);
    return {
      houseboat: boat,
      totalRooms: boat.totalRooms,
      bookedRooms: used,
      availableRooms: Math.max(0, boat.totalRooms - used),
      individualBookings: row?.individualCount ?? 0,
      sharingBookings: row?.sharingCount ?? 0,
      bookingType: isIndividual ? "individual" : ((row?.sharingCount ?? 0) > 0 ? "sharing" : "available")
    };
  });
}


export async function updateBooking(bookingId: string, input: BookingInput) {
  const session = await mongoose.startSession();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let updated: any = null;
  try {
    await session.withTransaction(async () => {
      const old = await Booking.findById(bookingId).session(session);
      if (!old || old.status !== "confirmed") throw new Error("Booking not found or no longer active");

      const boatIds = [String(old.houseboatId), input.houseboatId].sort();
      // Acquire per-houseboat write locks in deterministic order to serialize capacity checks.
      for (const id of [...new Set(boatIds)]) {
        const lockBoat = await Houseboat.findById(id).session(session);
        if (!lockBoat || lockBoat.status !== "active") throw new Error("Houseboat not found or inactive");
        await Houseboat.updateOne({ _id: lockBoat._id }, { $inc: { bookingRevision: 1 } }, { session });
      }

      const targetBoat = await Houseboat.findById(input.houseboatId).session(session);
      if (!targetBoat) throw new Error("Houseboat not found");

      const dayStart = new Date(`${input.bookingDate}T00:00:00.000Z`);
      const dayEnd = new Date(`${input.bookingDate}T23:59:59.999Z`);
      const existing = await Booking.find({
        _id: { $ne: old._id },
        houseboatId: targetBoat._id,
        bookingDate: { $gte: dayStart, $lte: dayEnd },
        status: "confirmed"
      }).session(session);

      if (existing.some(b => b.bookingType === "individual")) {
        throw new Error("This houseboat already has an individual booking for the selected date");
      }
      if (input.bookingType === "individual" && existing.length > 0) {
        throw new Error("Individual booking is not allowed because sharing bookings already exist");
      }

      const usedRooms = existing.reduce((sum, b) => sum + b.roomsBooked, 0);
      const rooms = input.bookingType === "individual" ? targetBoat.totalRooms : input.roomsBooked;
      if (input.bookingType === "individual" && input.roomsBooked !== targetBoat.totalRooms) {
        throw new Error(`Individual booking must occupy all ${targetBoat.totalRooms} rooms`);
      }
      if (usedRooms + rooms > targetBoat.totalRooms) {
        throw new Error(`Only ${Math.max(0, targetBoat.totalRooms - usedRooms)} room(s) are available`);
      }

      old.set({
        ...input,
        bookingDate: dayStart,
        roomsBooked: rooms,
        balanceAmount: input.totalAmount - input.advanceAmount
      });
      await old.save({ session });
      updated = old;
    }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
    return updated;
  } finally {
    await session.endSession();
  }
}
