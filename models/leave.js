import { Schema, model } from "mongoose";
import moment from "moment";
import genericSchema from "./generic.js";

// Define LeaveRequest Schema
const leaveRequestSchema = new Schema({
    employeeId: {
        type: String,
        required: [true, 'Employee Id is required.'],
        ref: 'users', // Assuming 'user' is the collection where employees are stored
    },
    orgId: {
        type: String,
        // required: [true, 'Organizatio Id is required.'],
        ref: 'organization', // Assuming you have an 'organization' collection for org details
    },
    leaveDays: [{
        date: { 
            type: Date, 
            required: [true, 'Date is required.'], 
        },
        leaveType: { 
            type: String, 
            enum: ['half_day', 'full_day'],
            required: [true, 'Leave type is required.'],
        }
    }],
    startDate: {
        date: { 
            type: Date, 
            required: [true, 'Start date is required.'], 
        },
        leaveType: { 
            type: String, 
            enum: ['half_day', 'full_day'], 
            required: [true, 'Leave type is required.'],
        }
    },
    endDate: {
        date: { 
            type: Date, 
            required: [true, 'End date is required.'], 
        },
        leaveType: { 
            type: String, 
            enum: ['half_day', 'full_day'],
            required: [true, 'Leave type is required.'],
        },
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
        required: [true, 'Status is required.'],
    },
    reason: {
        type: String, // Optional string field to store the reason for taking leave
        required: [false, 'Reason is required.'], // You can set this to `true` if you want to make it mandatory
        minlength: [10, 'Reason should be minimum 10 characters.'], // Minimum length for the reason (optional, adjust as needed)
        maxlength: [500, 'Reason should be max 500 characters.'], // Maximum length for the reason (optional, adjust as needed)
    },
    approverId: {
        type: String,
        validate: {
            validator: function(value) {
                // `this.status` will refer to the document being validated
                if (this.status !== 'pending' && !value) {
                    return false; // `approverId` is required if status is not 'pending'
                }
                return true; // If status is 'pending', `approverId` is not required
            },
            message: 'ApproverId is required when status is not "pending".',
        },
    }
}, {
    timestamps: true, // To track when the leave request was created or updated
});
leaveRequestSchema.add(genericSchema);

// Pre-save validation for leave days
leaveRequestSchema.pre('save', function(next) {
    // Check if a half-day leave is being applied in the middle of the range
    const leaveDays = this.leaveDays;

    const startDate = moment(this.startDate.date);
    const endDate = moment(this.endDate.date);

    // Check if half_day leave is applied between start and end date
    for (let i = 0; i < leaveDays.length; i++) {
        const leaveDay = moment(leaveDays[i].date);
        
        // Ensure half day leave is only applied on startDate or endDate (not in between)
        if (leaveDays[i].leaveType === 'half_day' && 
            !(leaveDay.isSame(startDate, 'day') || leaveDay.isSame(endDate, 'day'))) {
            throw new Error('Half day leave can only be applied on the start or end date, not in between.');
        }
    }

    // Ensure end date is not before start date
    if (moment(this.endDate.date).isBefore(moment(this.startDate.date))) {
        throw new Error('End date cannot be before start date.');
    }

    next();
});

// Model
const LeaveRequest = model('leaves', leaveRequestSchema);

export default LeaveRequest;
