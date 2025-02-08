import mongoose, { model } from "mongoose";
import genericSchema from "./generic.js";
const { Schema } = mongoose;

// SubDepartment Schema (nested)
const subDepartmentSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Sub-department name is required'],
    unique: [true, 'Sub-department code should be unique'], // Ensuring unique department code
  },
  code: {
    type: String,
    required: [true, 'Sub-department code is required'],
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  // You can add more fields specific to SubDepartment if needed
});

// Department Schema
const departmentSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Department name is required'],
    },
    code: {
      type: String,
      required: [true, 'Department code is required'],
      unique: [true, 'Department Code should be unique.'], // Ensuring unique department code
    },
    description: {
      type: String,
      required: false, // Optional description of the department
    },
    subDepartments: {
        type: [subDepartmentSchema],
        validate: {
          validator: function (v) {
            return v && v.length >= 1; // Ensure at least one sub-department
          },
          message: "Add at least one sub-department.",
        },
    }, // Array of SubDepartments
    isActive: {
      type: Boolean,
      default: true,
    },
  },
);

departmentSchema.add(genericSchema); // Add generic schema

// Department Model
const Department = model('department', departmentSchema);

export default Department;
