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
  regularization: {
    type: Boolean,
    default: false, // Indicates if this attendance is via regularization
  },
  orgId: {
    type: String,
    required: [true, 'Organization is required.'],
    default: '',
  },
});

// Virtual field: employeeDetail (populates emplooyee)
attendanceSchema.virtual('employeeDetail', {
  ref: 'users', // Reference to Employee model
  localField: 'employeeId', // Field in the This schema
  foreignField: 'uuid', // Field in the Employee schema
  justOne: true, // We expect only one employee
  options: {
    select: 'name designation position', // Select the fields we want from department
  },
});

attendanceSchema.add(genericSchema);
const Attendance = model('Attendance', attendanceSchema);
export {Attendance, attendanceSchema};
