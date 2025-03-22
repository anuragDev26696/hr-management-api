import mongoose, { Schema, model } from "mongoose";
import genericSchema from "./generic.js";

export const activityLogSchema = new Schema({
  // userId: {
  //   type: String,
  //   ref: "users",
  //   required: true,
  // },
  orgId: {
    type: String,
    required: [true, "Org Id is required."]
  },
  role: {
    type: String,
    enum: ["admin", "hr", "project manager", "employee"],
    required: [true, "Role is required."],
  },
  userName: {
    type: String,
    required: [true, "User name is required."],
  },
  action: {
    type: String,
    required: [true, "Action is required."],
  },
  module: {
    type: String,
    enum: ["Employee", "Attendance", "Leave", "Payroll", "Role"],
    required: [true, "Module is required."],
  },
  details: {
    type: String, // Human-readable message, e.g., "Admin added 5 new employees"
    required: [true, "Details is required."],
  },
});

activityLogSchema.add(genericSchema);

export const ActivityLog = mongoose.model("activityLog", activityLogSchema);