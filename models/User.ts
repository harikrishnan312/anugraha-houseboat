import mongoose, { Schema, models, model } from "mongoose";

const UserSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ["admin", "staff"], default: "staff", index: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export const User = models.User || model("User", UserSchema);
