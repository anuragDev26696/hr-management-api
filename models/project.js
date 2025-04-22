import { Schema, model } from 'mongoose';
import genericSchema from "./generic.js";

// Project Schema
const projectSchema = new Schema({
  name: {
    type: String,
    minlength: [3, "Name must be at least 3 characters long"],
    maxlength: [35, "Name should max 35 characters long"],
    required: [true, 'Project description is required.'],
  },
  description: {
    type: String,
    default: "",
    required: [true, 'Project description is required.'],
  },
  orgId: {
    type: String,
    required: [true, 'OrgID is required.'],
  }
});
projectSchema.virtual('members', {
  ref: 'projectMember',          // The model to use
  localField: 'uuid',            // Field in Project
  foreignField: 'projectId',     // Field in ProjectMember
  count: true                    // 👉 This is the key: return count instead of documents
});



// AssignProject Schema
const assignMemberSchema = new Schema({
  projectId: {
    type: String,
    ref: 'project',
    required: [true, "Project id is required."],
  },
  employeeId: {
    type: String,
    ref: 'users',
    required: [true, "Employee id is required."],
  },
  expiryDate: {
    type: Date,
    required: [true, "Expiry date is required."],
  },
  orgId: {
    type: String,
    required: [true, 'OrgID is required.'],
  }
});
assignMemberSchema.virtual('employeeDetail', {
  ref: 'users',          // The model to use
  localField: 'employeeId',            // Field in Assign Project Schema
  foreignField: 'uuid',     // Field in users
  justOne: true, // 👈 optional, if only one user is expected
});
assignMemberSchema.virtual('projectDetail', {
  ref: 'project',          // The model to use
  localField: 'projectId',            // Field in Assign project member Schema
  foreignField: 'uuid',     // Field in project
  justOne: true, // 👈 optional, if only one project is expected
});

// Inherit the base schema
projectSchema.add(genericSchema);
assignMemberSchema.add(genericSchema);
assignMemberSchema.set('toObject', { virtuals: true });
assignMemberSchema.set('toJson', { virtuals: true });
projectSchema.set('toObject', { virtuals: true });
projectSchema.set('toJSON', { virtuals: true });


export const ProjectMember = model('projectMember', assignMemberSchema);
export const Project = model('project', projectSchema);