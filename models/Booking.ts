import mongoose, { Schema, models, model } from "mongoose";

const BookingSchema = new Schema({
  houseboatId: { type: Schema.Types.ObjectId, ref: "Houseboat", default: null, },
  bookingDate: { type: Date, required: true, index: true },
  bookingType: { type: String, enum: ["sharing", "individual"], required: true },
  roomsBooked: { type: Number, required: true, min: 1 },
  clientName: { type: String, trim: true, maxlength: 120 },
  mobile: { type: String,trim: true, maxlength: 20 },
  totalAmount: { type: Number, required: true, min: 0 },
  advanceAmount: { type: Number, required: true, min: 0 },
  balanceAmount: { type: Number, required: true, min: 0 },
  isAgent: { type: Boolean, default: false },
  agentName: { type: String, trim: true, default: "" },
  underWhom: { type: String, trim: true, default: "" },
  status: { type: String, enum: ["confirmed", "cancelled"], default: "confirmed", index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null }
}, { timestamps: true });

BookingSchema.index({ houseboatId: 1, bookingDate: 1, status: 1 });
BookingSchema.index({ bookingDate: 1, status: 1 });
export const Booking = models.Booking || model("Booking", BookingSchema);
