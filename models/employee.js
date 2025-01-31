import mongoose from "mongoose";
import Login from "./login.js";
import genericSchema from "./generic.js";
import { addressSchema } from "./address.js";

// Define the employee schema
const employeeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      minlength: [3, "Name must be at least 3 characters long"], // Minimum length of 3 characters
      match: [/^[a-zA-Z\s]+$/, "Name can only contain letters and spaces"], // Regex to allow only letters and spaces
    },
    email: {
      type: String,
      required: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"], // Regex for email validation
      unique: true,
    },
    mobile: {
      type: String,
      required: [true, "Mobile number is required."],
      match: [/^[0-9]{10}$/, "Please enter a valid mobile number"], // Regex for email validation
      unique: [true, "Mobile number already exist."],
    },
    role: {
      type: String,
      enum: ["admin", "hr", "project manager", "employee"],
      required: true,
    },
    isAdmin: { type: Boolean, default: false },
    isHR: { type: Boolean, default: false },
    gender: { type: String, enum: ['Male', 'Female'] },
    department: {
      type: String,
      ref: "department", // Reference to Department collection
      default: null
    },
    subDepartment: { type: String },
    position: { type: String, default: null },
    designation: { type: String },
    joiningDate: { type: Date, default: new Date() },
    resignationDate: { type: Date, default: null },
    isActive: {type: Boolean, default: false},
    orgId: {type: String, default: ""},
    currentAddress: addressSchema,
    permanentAddress: addressSchema,
  },
  {
    timestamps: true, // Add createdAt and updatedAt timestamps
  }
);

// Inherit the base schema
employeeSchema.add(genericSchema); // Add the isDeleted and uuid fields from the base schema

// Virtual field 1: departmentDetail (populates department and subDepartment)
employeeSchema.virtual('departmentDetail', {
  ref: 'department', // Reference to Department model
  localField: 'department', // Field in the Employee schema
  foreignField: 'uuid', // Field in the Department schema
  justOne: true, // We expect only one department
  options: {
    select: 'name code subDepartments', // Select the fields we want from department
    populate: {
      path: 'subDepartments', // Populate subDepartments within the department
      match: { code: '$subDepartmentCode' }, // Match subDepartment code to employee's subDepartmentCode
      select: 'name code', // Select specific fields from the subDepartment
    },
  },
});

// Employee Schema
employeeSchema.methods.getFormattedJoinDate = function (locale) {
  // If joiningDate is not defined, return empty string
  if (!this.joiningDate) return '';

  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return this.joiningDate.toLocaleDateString(locale, options);
};

// Add custom pre-save validation to check some other conditions
employeeSchema.pre("save", function (next) {
  // Role-specific validation for joiningDate
  if (this.role !== 'admin' && !this.joiningDate) {
    return next(new Error('Joining date is required.'));
  }
  if (!this.isActive && !this.resignationDate) {
    return next(new Error('Resignation date is required.'));
  }
  if (this.isActive) {this.resignationDate = null;}

  // Set role-specific fields based on the role
  this.isAdmin = this.role === "admin";
  this.isHR = this.role === "hr";
  next();
});

employeeSchema.post('save', async function (doc) {
  try {
    // Check if login entry already exists, if not create a new one
    const existingLogin = await Login.findOne({ email: doc.email });

    if (!existingLogin) {
      const reqData = {email: doc.email, isAdmin: doc.isAdmin, isHR: doc.isHR, role: doc.role, password: null, userUUID: doc.uuid};
      const loginEntry = new Login(reqData);
      await loginEntry.save();
      console.log(`Login entry created for employee ${doc.email}`);
    } else {
      console.log(`Employee is already exist.`);
    }
  } catch (err) {
    console.error('Error creating login entry:', err);
  }
});


// You can also populate referenced fields when querying, for example:
// Employee.find({}).populate('department').exec();

const Employee = mongoose.model("users", employeeSchema);
export default Employee;