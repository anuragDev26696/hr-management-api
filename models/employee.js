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
    permissions: {
      type: [String],
      enum: ["payroll", "employee", "leave", "attendance", "holiday", "department", "project"],
      default: [],
    },
    gender: { type: String, enum: ["Male", "Female"] },
    bloodGroup: { type: String, default: "", match: [/^(A|B|AB|O)[+-]$/, "Please enter a valid blood group (e.g., A+, O-, AB+)."], },
    dateOfBirth: { type: Date, default: null },
    personalEmail: { type: String, default: "" },
    maritalStatus:{ type: String, default: "" },
    employeeId: { type: String, default: "", match: [/^[a-zA-Z0-9]+(-[a-zA-Z0-9]+)*$/, "Please enter a valid Employee Id."], },
    department: {
      type: String,
      ref: "department", // Reference to Department collection
      default: null,
    },
    subDepartment: { type: String },
    position: { type: String, default: null },
    designation: { type: String },
    joiningDate: { type: Date, default: new Date() },
    resignationDate: { type: Date, default: null },
    isActive: { type: Boolean, default: false },
    orgId: { type: String, default: "" , required: [true, 'Organization is required.']},
    currentAddress: addressSchema,
    permanentAddress: addressSchema,
    workingDays: {
      type: [String],
      validate: {
        validator: (v) => v.length <= 6, // Ensure workingDays is not greater than 6 days
        message: "Working days cannot exceed 6 days.",
      },
    },
    workingDaysHistory: [
      {
        startDate: {
          type: Date,
          required: [true, "Working start date is required"],
          validate: {
            // Ensure the start date is not less than the joining date
            validator: async function (value) {
              const user = await this.ownerDocument();  // Get parent document
              return value >= user.joiningDate;
            },
            message: 'Start date cannot be less than the joining date.',
          },
        }, // Start date of this working days policy
        endDate: { type: Date, default: null }, // End date of this working days policy (null for current policy)
        workingDays: {
          type: [String],
          required: [true, 'Working days is required.'],
          validate: {
            validator: (v) => v.length <= 6, // Ensure workingDays is not greater than 6 days
            message: "Working days cannot exceed 6 days.",
          },
        }, // List of working days during this period
      },
    ],
    facebookUrl: {type: String, default: '', match: [/^(https?:\/\/)(www\.)?[\w\-]+(\.[\w\-]+)+([\/?#][^\s]*)?$/, 'Invalid Facebook url. Url should be start with http or https.']},
    linkedinUrl: {type: String, default: '', match: [/^(https?:\/\/)(www\.)?[\w\-]+(\.[\w\-]+)+([\/?#][^\s]*)?$/, 'Invalid linkedin url. Url should be start with http or https.']},
    githubUrl: {type: String, default: '', match: [/^(https?:\/\/)(www\.)?[\w\-]+(\.[\w\-]+)+([\/?#][^\s]*)?$/, 'Invalid github url. Url should be start with http or https.']},
  },
);

// Inherit the base schema
employeeSchema.add(genericSchema); // Add the isDeleted and uuid fields from the base schema

// Virtual field 1: departmentDetail (populates department and subDepartment)
employeeSchema.virtual("departmentDetail", {
  ref: "department", // Reference to Department model
  localField: "department", // Field in the Employee schema
  foreignField: "uuid", // Field in the Department schema
  justOne: true, // We expect only one department
  options: {
    select: "name code subDepartments", // Select the fields we want from department
    populate: {
      path: "subDepartments", // Populate subDepartments within the department
      match: { code: "$subDepartmentCode" }, // Match subDepartment code to employee's subDepartmentCode
      select: "name code", // Select specific fields from the subDepartment
    },
  },
});

// Employee Schema
employeeSchema.methods.getFormattedJoinDate = function (locale) {
  // If joiningDate is not defined, return empty string
  if (!this.joiningDate) return "";

  const options = { year: "numeric", month: "long", day: "numeric" };
  return this.joiningDate.toLocaleDateString(locale, options);
};

// Add custom pre-save validation to check some other conditions
employeeSchema.pre("save", function (next) {
  // Role-specific validation for joiningDate
  if (this.role !== "admin" && !this.joiningDate) {
    return next(new Error("Joining date is required."));
  }
  if (!this.isActive && !this.resignationDate) {
    return next(new Error("Resignation date is required."));
  }
  if (this.isActive) {
    this.resignationDate = null;
  }

  if (this.isModified('workingDaysHistory')) {
    const lastHistory = this.workingDaysHistory[this.workingDaysHistory.length - 2];
    const newPolicy = this.workingDaysHistory[this.workingDaysHistory.length - 1];

    // Ensure that the end date of the previous working days policy is updated before adding the new one
    if (lastHistory) {
      //  If the previous policy exists, update its endDate to be the day before the new policy's startDate
      lastHistory.endDate = new Date(newPolicy.startDate - 1);
    }
  }

  next();
});

employeeSchema.post("save", async function (doc) {
  try {
    // Check if login entry already exists, if not create a new one
    const existingLogin = await Login.findOne({ email: doc.email });

    if (!existingLogin) {
      const reqData = {
        email: doc.email,
        role: doc.role,
        password: null,
        userUUID: doc.uuid,
        orgId: doc.orgId,
        isActive: doc.isActive,
      };
      const loginEntry = new Login(reqData);
      await loginEntry.save();
      console.log(`Login entry created for employee ${doc.email}`);
    } else {
      console.log(`Employee is already exist.`);
    }
  } catch (err) {
    console.error("Error creating login entry:", err);
  }
});

// You can also populate referenced fields when querying, for example:
// Employee.find({}).populate('department').exec();

const Employee = mongoose.model("users", employeeSchema);
export default Employee;
