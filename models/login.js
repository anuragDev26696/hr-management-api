import { Schema, model } from 'mongoose';
import bcrypt from 'bcryptjs';
import genericSchema from "./generic.js";

// Login Schema
const loginSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,  // Ensure email is unique
  },
  password: {
    type: String,
    default: null
  },
  role: {
    type: String,
    enum: ['admin', 'hr', 'employee'],
    required: true,
  },
  userUUID: {
    type: String,
    ref: 'user',  // Reference to the user who created this user (for admin tracking)
    required: true,
    unique: true,
  },
  orgId: {type: String, default: "", required: true,},
}, {
  timestamps: true,  // Automatically create createdAt and updatedAt fields
});

// Inherit the base schema
loginSchema.add(genericSchema); // Add the isDeleted and uuid fields from the base schema

// Pre-save hook to hash the password before saving
// loginSchema.pre('save', async function(next) {
  // if (this.isModified('password')) {
  //   this.password = await bcrypt.hash(this.password, 10);
  // }
//   next();
// });

// Method to check if password matches
loginSchema.methods.comparePassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const Login = model('login', loginSchema);

export default Login;