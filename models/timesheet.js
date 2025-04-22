import { Schema, model } from 'mongoose';
import genericSchema from "./generic.js";

// timeSheet Schema
const timeSheetSchema = new Schema({
  projectId: {
    type: String,
    ref: 'project',
    required: [true, "Project id is required."],
  },
  orgId: {
    type: String,
    required: [true, 'OrgID is required.'],
  },
  timesheetDate: {
    type: Date,
    default: new Date()
  },
  tasks: [
    {
      title: {type: String, required: [true, "Title is required."], default: '', minlength: 5, maxlength: 100,},
      description: { type: String, required: [true, "Description is required."], default: '', maxlength: 1500, },
      timeTaken: {type: Number, required: true, default: 0},
    },
  ],
  timeTaken: {
    type: Number, // in minutes or seconds
    default: 0,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'resubmitted'],
    default: 'pending',
    index: true,
  },
  isRejected: {
    type: Boolean,
    default: false,
    index: true,
  },
  remark: {
    type: String,
    default: '',
  },
});

// Virtual field for populating user details
timeSheetSchema.virtual('user', {
  ref: 'users',
  localField: 'createdBy', // field in timeSheet schema
  foreignField: 'uuid', // field in User schema
  justOne: true, // we assume a user can have only one timesheet record
});

// Virtual field for populating project details
timeSheetSchema.virtual('project', {
  ref: 'project',
  localField: 'projectId', // field in timeSheet schema
  foreignField: 'uuid', // field in Project schema
  justOne: true, // we assume one project can have many timesheet records
});

// Enable populating virtual fields
timeSheetSchema.set('toObject', { virtuals: true });
timeSheetSchema.set('toJSON', { virtuals: true });

// Inherit the base schema
timeSheetSchema.add(genericSchema);
export const TimeSheet = model('timeSheet', timeSheetSchema);

timeSheetSchema.pre('save', function (next) {
    if (Array.isArray(this.tasks) && this.tasks.length > 0) {
      this.timeTaken = this.tasks.reduce((sum, task) => sum + (task.timeTaken || 0), 0);
    //   this.set('timeTaken', total);
    } else {
      this.timeTaken = 0;
    }
    next();
});

timeSheetSchema.pre(/^(updateMany|update)$/, async function (next) {
    const update = this.getUpdate();
    this.setUpdate(handleTaskTimeRecalculation(update));
    next();
});

timeSheetSchema.pre('updateOne', async function (next) {
    const update = this.getUpdate();
    this.setUpdate(handleTaskTimeRecalculation(update));
    next();
});

timeSheetSchema.pre('updateMany', async function (next) {
    const update = this.getUpdate();
    this.setUpdate(handleTaskTimeRecalculation(update));
    next();
});
timeSheetSchema.pre('update', async function (next) {
    const update = this.getUpdate();
    this.setUpdate(handleTaskTimeRecalculation(update));
    next();
});    

// To avoid repeating yourself, define a reusable helper:
function handleTaskTimeRecalculation(update) {
    if(!update) return;
    const tasks = update?.tasks || update?.$set?.tasks;
    const total = Array.isArray(tasks) ? tasks.reduce((sum, task) => sum + (task.timeTaken || 0), 0) : 0;
    // if (!update.$set) update.$set = {};
    // update.$set.timeTaken = timeTaken;
    if (update.$set) {
        update.$set.timeTaken = total;
    } else {
        update.timeTaken = total;
    }
    return update;
}


timeSheetSchema.pre(['findOneAndUpdate', 'updateOne'], async function (next) {
    const update = this.getUpdate();
    const updateTasks = update?.$addToSet?.tasks?.$each;
  
    if (Array.isArray(updateTasks) && updateTasks.length > 0) {
      // Get current document from DB
      const docToUpdate = await this.model.findOne(this.getQuery());
  
      const existingTasks = docToUpdate?.tasks || [];
  
      const allTasks = [...existingTasks, ...updateTasks];
  
      const total = allTasks.reduce((sum, task) => sum + (task.timeTaken || 0), 0);
  
      // Apply to update
      if (!update.$set) update.$set = {};
      update.$set.timeTaken = total;
  
      this.setUpdate(update);
    }
  
    next();
});
  

// 🧩 $push and $addToSet in MongoDB
// Both are update operators used to modify array fields in a document.

// $push – Add Items to an Array (Always Adds)
// Use $push when you want to add a new value to an array, regardless of whether it already exists. Can control position and sorting in array updates.
// $push: {
//     items: {
//       $each: [4, 5],
//       $position: 1, // insert at index 1
//       $sort: 1,
//       $slice: 3
//     }
// }

// $addToSet – Add Unique Items Only
// Use $addToSet when you want to add a value only if it doesn’t already exist in the array (like a Set in JS).
// Prevents duplicate entries without needing extra logic in code. Cleaner for tags, labels, etc. where uniqueness matters.

// ---------------------------------------------------------------------------------------------------------------
// Use Case                                      | Operator             | Why?
// ---------------------------------------------------------------------------------------------------------------
// Adding logs, history, messages                | $push                | You always want to keep a record.
// Adding tags, categories, unique labels        | $addToSet            | You want to avoid duplicates.
// Complex inserts (sorting/slicing during push) | $push with modifiers | Gives full control over how arrays grow.