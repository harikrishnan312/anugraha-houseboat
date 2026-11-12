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
      let boat = null;
      let rooms = input.roomsBooked;

      // Houseboat is mandatory for individual bookings
      if (input.bookingType === "individual" && !input.houseboatId) {
        throw new Error("Houseboat is required for individual booking");
      }

      // Validate boat only when selected
      if (input.houseboatId) {
        boat = await Houseboat.findById(input.houseboatId).session(session);

        if (!boat || boat.status !== "active") {
          throw new Error("Houseboat not found or inactive");
        }

        // Serialize booking attempts for this boat
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
          throw new Error("This houseboat already has an individual booking");
        }

        if (input.bookingType === "individual") {
          if (existing.length > 0) {
            throw new Error("Sharing bookings already exist");
          }

          rooms = boat.totalRooms;
        } else {
          const usedRooms = existing.reduce(
            (sum, b) => sum + b.roomsBooked,
            0
          );

          if (usedRooms + rooms > boat.totalRooms) {
            throw new Error(
              `Only ${Math.max(0, boat.totalRooms - usedRooms)} room(s) available`
            );
          }
        }
      } else {
        // Sharing booking without a selected houseboat
        if (input.bookingType !== "sharing") {
          throw new Error("Houseboat is required");
        }
      }

      const dayStart = new Date(`${input.bookingDate}T00:00:00.000Z`);

      const [doc] = await Booking.create([{
        ...input,
        houseboatId: boat?._id ?? null,
        bookingDate: dayStart,
        roomsBooked: rooms,
        balanceAmount: input.totalAmount - input.advanceAmount,
        status: "confirmed"
      }], { session });

      created = doc;
    }, {
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" }
    });

    return created;
  } finally {
    await session.endSession();
  }
}


export async function getAvailability(bookingDate: string) {
  const start = new Date(`${bookingDate}T00:00:00.000Z`);
  const end = new Date(`${bookingDate}T23:59:59.999Z`);

  const boats = await Houseboat.find({ status: "active" }).lean();

  const booked = await Booking.aggregate([
    {
      $match: {
        bookingDate: { $gte: start, $lte: end },
        status: "confirmed",
      },
    },
    {
      $group: {
        _id: "$houseboatId",
        roomsBooked: { $sum: "$roomsBooked" },
        individualCount: {
          $sum: {
            $cond: [{ $eq: ["$bookingType", "individual"] }, 1, 0],
          },
        },
        sharingCount: {
          $sum: {
            $cond: [{ $eq: ["$bookingType", "sharing"] }, 1, 0],
          },
        },
      },
    },
  ]);

  const map = new Map(booked.map(x => [String(x._id), x]));

  // Bookings without an assigned houseboat
  const unassigned = map.get("null");

  const unassignedRooms = unassigned?.roomsBooked ?? 0;

  const totalFleetRooms = boats.reduce(
    (sum, boat) => sum + boat.totalRooms,
    0
  );

  const assignedBookedRooms = boats.reduce((sum, boat) => {
    const row = map.get(String(boat._id));
    return sum + (row?.roomsBooked ?? 0);
  }, 0);

  const totalBookedRooms = assignedBookedRooms + unassignedRooms;

  return {
    totalFleetRooms,
    totalBookedRooms,
    availableFleetRooms: Math.max(0, totalFleetRooms - totalBookedRooms),

    unassignedBookings: {
      bookedRooms: unassignedRooms,
      individualBookings: unassigned?.individualCount ?? 0,
      sharingBookings: unassigned?.sharingCount ?? 0,
    },

    houseboats: boats.map(boat => {
      const row = map.get(String(boat._id));
      const isIndividual = (row?.individualCount ?? 0) > 0;
      const used = isIndividual
        ? boat.totalRooms
        : (row?.roomsBooked ?? 0);

      return {
        houseboat: boat,
        totalRooms: boat.totalRooms,
        bookedRooms: used,
        availableRooms: Math.max(0, boat.totalRooms - used),
        individualBookings: row?.individualCount ?? 0,
        sharingBookings: row?.sharingCount ?? 0,
        bookingType: isIndividual
          ? "individual"
          : ((row?.sharingCount ?? 0) > 0 ? "sharing" : "available"),
      };
    }),
  };
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
