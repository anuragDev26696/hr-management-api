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
    // totalCasualLeaves: {
    //     type: Number,
    //     default: 0,
    // },
    lastCreditedCL: {
        type: Number,
        default: 0,
    },
    remainingCL: {
        type: Number,
        default: 0,
    },
    appliedCL: {
        type: Number,
        default: 0,
    },
    appliedLOP: {
        type: Number,
        default: 0,
    },
    lastCreditDate: {
        type: Date,
        default: new Date(),
        required: [true, "Credit date is required."]
    },
    leaveHistory: [{
        year: {
            type: Date,
            required: [true, 'Year is required for history'],
        },
        appliedCL: {
            type: Number,
            default: 0,
        },
        appliedLOP: {
            type: Number,
            default: 0,
        },
        remainedCL: {
            type: Number,
            default: 0,
        },
    }],
});

leaveBalanceSchema.add(genericSchema);
const LeaveBalance = model('leaveBalance', leaveBalanceSchema);
export {LeaveBalance, leaveBalanceSchema};