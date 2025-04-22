// models/BaseSchema.js

import { Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid'; // Use uuidv4 for generating UUIDs

// Define a generic base schema
const genericSchema = new Schema(
  {
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, default: null },
    uuid: { type: String, unique: true, default: () => uuidv4() },
  },
  { timestamps: true } // This will automatically add createdAt and updatedAt fields
);

// Pre-save hook to ensure the UUID is generated for new documents
genericSchema.pre('save', function(next) {
  if (!this.uuid) {
    this.uuid = uuidv4();
  }
  // Ensure createdBy is not null before saving
  if (!this.createdBy || this.createdBy.trim() === "" || this.createdBy === undefined || this.createdBy == null) {
    this.createdBy = this.uuid;  // Or use another value for createdBy
  }
  next();
});

// Pre-hook for `findOne`, `findById`, `findOneAndDelete`, etc.
genericSchema.pre(/^findOne|findById|findOneAndDelete|findOneAndUpdate|findByIdAndDelete|findByIdAndUpdate$/, function (next) {
  // Check if the query has the `isDeleted` flag, if not, apply `isDeleted: false`
  this.where({ isDeleted: this.options.isDeleted ||false });
  next();
});

// Export the base schema
export default genericSchema;