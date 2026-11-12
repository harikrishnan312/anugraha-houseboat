import mongoose, { Schema, models, model } from "mongoose";

const HouseboatSchema = new Schema({
  boatName: { type: String, required: true, trim: true, maxlength: 120 },
  totalRooms: { type: Number, required: true, min: 1, max: 100 },
  status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
  bookingRevision: { type: Number, default: 0 }
}, { timestamps: true });

HouseboatSchema.index({ boatName: 1 }, { unique: true });
export const Houseboat = models.Houseboat || model("Houseboat", HouseboatSchema);
