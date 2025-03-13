import { model, Schema } from "mongoose";
import genericSchema from "./generic.js";

const leaveBalanceSchema = new Schema({
    employeeId: {
        type: String,
        required: [true, 'Employee Id is required.'],
        ref: 'users',
    },
    orgId: {
        type: String,
        required: [true, 'Organization Id is required.'],
    },
    totalCasualLeaves: {
        type: Number,
        default: 0,
    },
    creditedCasualLeaves: {
        type: Number,
        default: 0,
    },
    remainingCasualLeaves: {
        type: Number,
        default: 0,
    },
    appliedCasualLeaves: {
        type: Number,
        default: 0,
    },
    totalLopLeaves: {
        type: Number,
        default: 0,
    },
    remainingLopLeaves: {
        type: Number,
        default: 0,
    },
    appliedLopLeaves: {
        type: Number,
        default: 0,
    },
    lastCreditDate: {
        type: Date,
        default: new Date(),
        required: [true, "Credit date is required."]
    }
    // leaveHistory: [{
    //     month: {
    //         type: Date,
    //         required: [true, 'Month is required for history'],
    //     },
    //     credited: {
    //         type: Number,
    //         default: 0,
    //     },
    //     applied: {
    //         type: Number,
    //         default: 0,
    //     },
    //     remaining: {
    //         type: Number,
    //         default: 0,
    //     },
    // }],
});

leaveBalanceSchema.add(genericSchema);
const LeaveBalance = model('leaveBalance', leaveBalanceSchema);
export {LeaveBalance, leaveBalanceSchema};