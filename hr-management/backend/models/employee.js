import mongoose from "mongoose";
import Login from "./login.js";
import genericSchema from "./generic.js";

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
    position: { type: String },
    designation: { type: String },
    subDepartment: { type: String },
    joiningDate: { type: Date, default: new Date() },
    resignationDate: { type: Date, default: null },
    isActive: {type: Boolean, default: false},
    jobTitle: {type: String, default: null},
    orgId: {type: String, default: ""},
  },
  {
    timestamps: true, // Add createdAt and updatedAt timestamps
  }
);

// Inherit the base schema
employeeSchema.add(genericSchema); // Add the isDeleted and uuid fields from the base schema

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