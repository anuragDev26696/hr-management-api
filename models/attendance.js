import { model, Schema } from "mongoose";
import genericSchema from "./generic.js";

// Define the clockin schema
const ClockinSchema = new Schema({
    inTime: { type: Date, required: true, default: null },
    outTime: { type: Date, default: null },
});

// Define the Attendance schema
const attendanceSchema = new Schema(
  {
    userUUID: {
      type: String,
      required: true,
      ref: 'user'
    },
    attendanceDate: {type: Date, required: true, default: new Date()},
    workDuration: { type: Number, default: 0},
    metaData: { type: [ClockinSchema], require: true}
    // metaData: {
    //     type: Map,  // Allows arbitrary key-value pairs
    //     of: Schema.Types.Mixed,  // The value can be any type
    //     required: false 
    // },

  },
  {
    timestamps: true,
  }
);

// Inherit the base schema
attendanceSchema.add(genericSchema);

// Add custom pre-save validation to check some other conditions
attendanceSchema.pre("save", function (next) {
  this.createdBy = this.userUUID;
  next();
});

const Attendance = model("attendance", attendanceSchema);
export default Attendance;