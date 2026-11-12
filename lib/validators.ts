import { z } from "zod";

export const houseboatSchema = z.object({
  boatName: z.string().trim().min(2).max(120),
  totalRooms: z.coerce.number().int().min(1).max(100),
  status: z.enum(["active", "inactive"]).default("active")
});

export const bookingSchema = z.object({
  houseboatId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid houseboat ID"),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  bookingType: z.enum(["sharing", "individual"]),
  roomsBooked: z.coerce.number().int().min(1),
  clientName: z.string().trim().min(2).max(120),
  mobile: z.string().trim().min(6).max(20),
  totalAmount: z.coerce.number().min(0),
  advanceAmount: z.coerce.number().min(0),
  isAgent: z.boolean().default(false),
  agentName: z.string().trim().max(120).optional().default(""),
  underWhom: z.string().trim().max(120).optional().default(""),
  createdBy: z.string().optional()
}).refine(v => v.advanceAmount <= v.totalAmount, {
  message: "Advance cannot exceed total amount",
  path: ["advanceAmount"]
});
