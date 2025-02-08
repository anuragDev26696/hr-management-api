import { Schema, model } from 'mongoose';
import genericSchema from './generic.js';

const regularizationSchema = new Schema({
  employeeId: {
    type: String,
    required: [true, 'Employee id is required.'],
    default: null,
  },
  attendanceDate: {
    type: Date,
    required: [true, 'Attendance date is required.'],
    validate: {
      validator: function(value) {
        const currentDate = new Date();
        return value <= currentDate; // Attendance date should not be greater than the current date
      },
      message: 'Attendance date cannot be in the future.',
    },
  },
  clockInTime: {
    type: Date,
    required: [true, 'Clock in time is required.'],
  },
  clockOutTime: {
    type: Date,
    required: [true, 'Clock out time is required.'],
  },
  reason: {
    type: String,
    required: [true, 'Reason for regularization is required.'],
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending',
  },
  orgId: {
    type: String, // Organization ID to verify the request's validity
    default: ''
  },
});

regularizationSchema.add(genericSchema);

// Virtual field : employeeDetail
regularizationSchema.virtual("employeeDetail", {
  ref: "users", // Reference to Employee model
  localField: "employeeId", // Field in Regularization schema
  foreignField: "uuid", // If employeeId references uuid, make sure the field names match
  justOne: true,
  // options: {
  //   select: "name role orgId createdBy", // Fields to select
  // },
});

const Regularization = model('Regularization', regularizationSchema);
export { Regularization, regularizationSchema };
