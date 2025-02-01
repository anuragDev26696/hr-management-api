import { Schema, model } from 'mongoose';
import genericSchema from './generic.js';

const attendanceSchema = new Schema({
  employeeId: {
    type: String,
    ref: 'users',
    required: [true, 'Employee id is required.'],
  },
  clockInTime: {
    type: Date,
    required: [true, 'Clock in time is required.'],
  },
  clockOutTime: {
    type: Date,
    default: null,
  },
  status: {
    type: String,
    enum: ['Present', 'Absent', 'Leave'],
    default: 'Present',
  },
  totalHours: {
    type: Number, // Total worked hours in a day
    default: 0,
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

attendanceSchema.add(genericSchema);
const Attendance = model('Attendance', attendanceSchema);
export {Attendance, attendanceSchema};
