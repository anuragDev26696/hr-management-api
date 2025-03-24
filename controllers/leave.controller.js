import moment from 'moment';
import Employee from '../models/employee.js';
import Leaves from '../models/leave.js'; // import schema
import { LeaveBalance } from '../models/leaveBalance.js';
import { newLogActivity } from './activity.controller.js';

// Create a leave request
export const applyLeave =  async (req, res) => {
    let message = "Leave applied successfully.";
    try {
        const { uuid, orgId, name, role } = req.user;
        const {isApplyCL} = req.body;
        // Check if employee exists
        const employee = await Employee.findOne({uuid, orgId, isActive: true});
        if (!employee) {
            return res.status(404).json({ message: "Employee not found." });
        }

        // Ensure leave balance exists
        await createLeaveBalanceIfNotExists(uuid, orgId);
        // Fetch leave balance after creation (if it didn't exist before)
        const leaveBalanceDoc = await LeaveBalance.findOne({employeeId: uuid});
        if(!leaveBalanceDoc){
            message = "Leave balance is not available.";
            return res.status(400).json({message, error: message});
        }
        
        // Validation for date
        const isValidStartDate = !isNaN(Date.parse(new Date(req.body.startDate.date)));
        const isValidEndDate = !isNaN(Date.parse(new Date(req.body.endDate.date)));
        if (!isValidStartDate || !isValidEndDate) {
            message = 'Invalid date format.';
            return res.status(400).json({ error: message, message });
        }
        const joinDate = moment(employee.joiningDate);
        const startDate = moment(req.body.startDate.date);
        const endDate = moment(req.body.endDate.date);
        if(startDate.isBefore(joinDate, 'day') || endDate.isBefore(startDate, 'day')){
            message = endDate.isBefore(startDate, 'day') ? 'Start date should be before of the end date.' : 'You can\'t apply leave of the date before of the joining date.';
            return res.status(400).json({ error: message, message });
        }

        // Generate leaveDays array (start/end dates and leave type)
        const leaveDays = generateLeaveDaysArray(req.body.startDate, req.body.endDate, []).days;
        const dayCounts = generateLeaveDaysArray(req.body.startDate, req.body.endDate, []).daysCount;
        let remainingCL = leaveBalanceDoc.remainingCL;
        let deductedCL = 0;
        let deductedLOP = 0;

        if (isApplyCL) {
            if (dayCounts <= remainingCL) {
                // Deduct all from CL
                deductedCL = dayCounts;
            } else {
                // Deduct available CL, and the remaining from LOP
                deductedCL = remainingCL;
                deductedLOP = dayCounts - remainingCL;
            }
        } else {
            // Deduct everything from LOP
            deductedLOP = dayCounts;
        }
        const leaveRequest = new Leaves({
            ...req.body,
            orgId,
            employeeId: uuid,
            createdBy: uuid,
            leaveDays,
            deductedCL, deductedLOP
        });

        // Save leave request
        await leaveRequest.save();
        // Update leave balance
        await LeaveBalance.updateOne({ employeeId: uuid }, {
            $inc: {
                remainingCL: -deductedCL,
                appliedCL: deductedCL,
                appliedLOP: deductedLOP
            }
        });
        let activity_message = `${name} applied ${deductedCL} casual leave and ${deductedLOP} LOP leave.`;
        await newLogActivity(uuid, role, name, 'Leave', 'Applied Leave', orgId, activity_message);
        return res.status(201).json({ message, data: leaveRequest, success: true });
    } catch (err) {
        return res.status(400).json({ error: err.message, message: err.message || 'Something went wrong.' });
    }
};
// Generate leave days array for multiple days, checking half/full day
function generateLeaveDaysArray(startDate, endDate, leaveDays) {
    const days = [];
    let currentDate = moment(startDate.date);
    const endMoment = moment(endDate.date);
    let daysCount = 0;

    while (currentDate.isSameOrBefore(endMoment, 'day')) {
        const startMoment = moment(startDate.date);
        let leaveType = currentDate.isSame(startMoment, 'day') ? startDate.leaveType : currentDate.isSame(endMoment, 'day') ? endDate.leaveType : 'full_day'; // default to full day
        days.push({
            date: new Date(currentDate.toDate()),
            leaveType
        });
        daysCount += leaveType === 'full_day' ? 1 : 0.5;
        currentDate.add(1, 'days');
    }

    return {days, daysCount};
}

// Fetch all leave requests
export const getLeaves = async (req, res) => {
    try {
        let { uuid, role, orgId } = req.user;
        let { skip = 0, limit = 20, status = "", employeeId = uuid } = req.body;
        // employeeId = employeeId && employeeId.trim() !== '' ? employeeId : uuid; 
        const leaveRequests = await Leaves.aggregate(generateLeaveAggregationQuery(orgId, employeeId, null, null, skip, limit, status));
        const total = leaveRequests.length > 0 ? leaveRequests[0].totalCount : 0;
        const data = {docs: leaveRequests[0].data, total: leaveRequests[0].totalCount[0]?.count || 0};
        return res.status(200).json({data: data, message: 'Leaves retrived', success: true});
    } catch (err) {
        return res.status(500).json({ error: err.message, message: err.message || 'Something went wrong.' });
    }
};

// Fetch leave status of the employee
export const getLeaveStatus = async (req, res) => {
    try {
        let { uuid, orgId } = req.user;
        // employeeId = employeeId && employeeId.trim() !== '' ? employeeId : uuid; 
        const doc = await LeaveBalance.findOne({employeeId: uuid, orgId });
        const message = 'Leave balamce ' + (doc == null ? 'not found.' :  'found.');
        if(doc == null){
            return res.status(404).json({error: message, message});
        }
        return res.status(200).json({data: doc, message, success: true});
    } catch (err) {
        return res.status(500).json({ error: err.message, message: err.message || 'Something went wrong.' });
    }
};

// Update leave status (admin or HR approval/rejection)
export const updateStatus = async (req, res) => {
    try {
        const { status, leaveIds=[] } = req.body;
        const { uuid, role, name, orgId } = req.user;
        if (!status || leaveIds.length < 1 || !['approve', 'reject'].includes(status)) {
            return res.status(404).json({ message: "Provide a complete data." });
        }
        const mdStatus = status === 'approve' ? 'approved' : 'rejected';
        // update leave balance if status is reject.
        if(status === 'reject'){
            const leaveQuery = {uuid: {$in: leaveIds}, status: 'pending'};
            await creditLeaves(leaveQuery);
        }
        // Update leave status
        await Leaves.updateMany(
            { uuid: {$in: leaveIds}, status: 'pending' },
            { $set: {
                status: mdStatus,
                approverId: uuid,
                updatedAt: Date.now(),
            } },
        );
        const updatedLeaves = await Leaves.find({uuid: {$in: leaveIds}});
        await newLogActivity(uuid, role, name, 'Leave', mdStatus+' Leave', orgId, `${name} ${mdStatus} ${leaveIds.length} leave.`);
        return res.status(200).json({ message: "Leave status updated.", data: updatedLeaves, success: true });
    } catch (err) {
        return res.status(400).json({ error: err.message, message: err.message || 'Server Error.' });
    }
};

// Cancel leave by employee
export const cancelLeave = async (req, res) => {
    try {
        const employeeId = req.user.uuid;
        const {name, role, orgId} = req.user;
        const {id} = req.params;
        if (Array.isArray(id)) {
            const leaveQuery = {uuid: {$in: id}, status: 'pending', employeeId: employeeId};
            await creditLeaves(leaveQuery);  // update leave balance
            const result = await Leaves.deleteMany(leaveQuery);
            await newLogActivity(employeeId, role, name, 'Leave', 'Cancel Leave', orgId, `${name} Canceled ${id.length} leave.`);
            return res.status(200).json({ message: "Leave status updated.", data: result, success: true });
        } else {
            const leaveRequest = await Leaves.findOne({uuid: id, employeeId});

            if (!leaveRequest) {
                return res.status(404).json({ message: "Leave request not found." });
            }

            if (leaveRequest.status !== 'pending') {
                return res.status(400).json({ message: "Leave request cannot be cancel after approval/rejection." });
            }
            await updateLeaveBalance(leaveRequest); // Update leave balance before canceling
            const result = await Leaves.findOneAndDelete({uuid: id, employeeId});
            await newLogActivity(employeeId, role, name, 'Leave', 'Cancel Leave', orgId, `${name} Canceled leave.`);
            return res.status(200).json({ message: "Leave Canceled.", data: result, success: true });
        }
    } catch (err) {
        return res.status(400).json({ error: err.message, message: err.message || 'Something went wrong.' });
    }
};

const creditLeaves = async (leaveQuery) => {
    const leaveDocs = await Leaves.find(leaveQuery);
    const leaveBalanceUpdate = new Map();
    for(let doc of leaveDocs){
        let leaveBalanceDoc = leaveBalanceUpdate.get(doc.employeeId);
        if(!leaveBalanceDoc){
            leaveBalanceDoc = await LeaveBalance.findOne({employeeId: doc.employeeId});
            leaveBalanceUpdate.set(doc.employeeId, leaveBalanceDoc);
        }
        leaveBalanceDoc.remainingCL += doc.deductedCL;
        leaveBalanceDoc.appliedLOP -= doc.deductedLOP;
        leaveBalanceDoc.appliedCL -= doc.deductedCL;
    }
    // Update all leave balances in parallel
    await Promise.all(Array.from(leaveBalanceUpdate.values()).map(doc => doc.save()));
}

const updateLeaveBalance = async (leaveRequest) => {
    let leaveBalanceDoc = await LeaveBalance.findOne({ employeeId: leaveRequest.employeeId });
    if (!leaveBalanceDoc) return;
    // Deduct leaves
    leaveBalanceDoc.remainingCL += leaveRequest.deductedCL;
    leaveBalanceDoc.appliedLOP -= leaveRequest.deductedLOP;
    leaveBalanceDoc.appliedCL -= leaveRequest.deductedCL;

    // const daysCount = calculateLeaveDays(leaveRequest.leaveDays);
    // if (leaveRequest.leaveType === 'CL') {
    //     leaveBalanceDoc.remainingCL += daysCount;
    // } else {
    //     leaveBalanceDoc.remainingLOP += daysCount;
    // }
    await leaveBalanceDoc.save(); // Save only the updated fields
};

// Function to calculate leave days
const calculateLeaveDays = (leaveDays) => {
    return leaveDays.reduce((total, day) => total + (day.leaveType === 'full_day' ? 1 : 0.5), 0);
};

export const monthlyLeaves = async (req, res) => {
    try {
        const { employeeId, month, year } = req.query;
        const { role, uuid, orgId } = req.user;

        // Validate the month and year parameters
        if (!month || !year) {
            return res.status(400).json({ message: "'month' and 'year' are required." });
        }

        const leaveMonth = parseInt(month);
        const leaveYear = parseInt(year);

        if (isNaN(leaveMonth) || isNaN(leaveYear) || leaveMonth < 1 || leaveMonth > 12) {
            return res.status(400).json({ message: "'month' must be between 1 and 12 and 'year' must be valid." });
        }

        // If in request employeeId is not match with loggedin user id or loggedin user is not Admin
        if(role !== 'admin' && uuid !== employeeId){
            return res.status(401).json({ message: "Invalid employee", success: false, data: [] });
        }
        // It's an default query 
        // let queryData = {
        //     employeeId: employeeId,
        //     "leaveDays.date": {
        //         $gte: moment(`${leaveYear}-${leaveMonth}-01`).startOf('month').toDate(),
        //         $lt: moment(`${leaveYear}-${leaveMonth}-01`).endOf('month').toDate()
        //     }
        // };

        // Build the query to match the leaveDays array by checking the month and year of the date
        // const leaves = await LeaveRequest.find(queryData);
        // Return the filtered leaves and their total count
        // const totalCount = filteredLeaves.length;
        // If no data found, return totalCount as 0
        // const totalCount = leaves.length > 0 ? leaves[0].totalCount : 0;
        // return res.status(200).json({ totalCount, filteredLeaves });

        // Get data by agreegation
        const leaveRequests = await Leaves.aggregate(generateLeaveAggregationQuery(orgId, employeeId, leaveYear, leaveMonth));
        const total = leaveRequests.length > 0 && leaveRequests[0].totalCount.length > 0 ? leaveRequests[0].totalCount[0].count : 0;
        const data = {docs: leaveRequests[0].data, total};
        return res.status(200).json({ data, message: 'Leaves retrieved', success: true });
    } catch (err) {
        return res.status(400).json({ error: err.message, message: err.message || 'Something went wrong.' });
    }
};

export const createLeaveBalanceIfNotExists = async (employeeId, orgId) => {
    try {
        const existingLeaveBalance = await LeaveBalance.findOne({ employeeId });

        if (!existingLeaveBalance) {
            const newLeaveBalance = new LeaveBalance({
                employeeId,
                orgId,
                lastCreditDate: new Date(), // Setting credit date to current date
            });

            await newLeaveBalance.save();
            console.log(`Leave balance created for Employee ID: ${employeeId}`);
            return newLeaveBalance;
        }

        return existingLeaveBalance;
    } catch (error) {
        console.error("Error creating leave balance:", error);
        throw error;
    }
};

function aggregateLeaves(employeeId, leaveYear, leaveMonth) {
    return [
        // Stage 1: Match the employeeId and filter the leaveDays based on the requested month and year
        {
            $match: {
                employeeId: employeeId,  // Match by employeeId
                "leaveDays.date": {
                    $gte: moment(`${leaveYear}-${leaveMonth}-01`).startOf('month').toDate(),
                    $lt: moment(`${leaveYear}-${leaveMonth}-01`).endOf('month').toDate(),
                },
            }
        },
        // Stage 2: Unwind the leaveDays array
        {
            $unwind: "$leaveDays",  // Deconstruct the leaveDays array into individual documents
        },
        // Stage 3: Match leaveDays by month and year using $expr to compare the month and year of the date
        {
            $match: {
                $expr: {
                    $and: [
                        { $eq: [{ $month: "$leaveDays.date" }, leaveMonth] },  // Check the month
                        { $eq: [{ $year: "$leaveDays.date" }, leaveYear] },   // Check the year
                    ]
                }
            }
        },
        // Stage 4: Lookup to populate employee details from the Employee collection
        {
            $lookup: {
                from: 'employees', // Employee collection name
                localField: 'employeeId', // Field in LeaveRequest to match with Employee _id
                foreignField: 'uuid', // Field in Employee collection to match
                as: 'employeeData', // Name of the populated field
            }
        },
        // Stage 5: Unwind the populated employeeData array (in case there's only one employee)
        {
            $unwind: {
                path: '$employeeData',  // Flatten the employeeData array
                preserveNullAndEmptyArrays: true  // Optionally keep the document even if no employee data is found
            }
        },
        // Stage 6: Project the necessary fields
        {
            $project: {
                _id: 1,
                employeeId: 1,
                orgId: 1,
                leaveDays: 1,
                startDate: 1,
                endDate: 1,
                status: 1,
                reason: 1,
                createdAt: 1,
                updatedAt: 1,
                // Include only selected employee fields
                employeeName: '$employeeData.name',  // Assuming the name field exists in Employee model
                employeePosition: '$employeeData.position',  // Assuming the position field exists in Employee model
            }
        },
        // Stage 7: Count the total number of matching documents
        {
            $count: "totalCount"  // Get the total count of leave requests
        }
    ];
}

function generateLeaveAggregationQuery( orgId, employeeId="", leaveYear, leaveMonth, skip, limit, status ) {
    const matchCondition = {
        ...(employeeId.trim() !== '' && { createdBy: employeeId }), // Only add employeeId if it's passed
        ...(status && { status: status }), // Only add status if it's passed
        orgId,
    };

    // Add a match condition for leaveDays.date for the given month and year
    if (leaveYear && leaveMonth) {
        matchCondition["$or"] = [
            {
                "leaveDays.date": {
                    $gte: moment(`${leaveYear}-${leaveMonth}-01`).startOf('month').toDate(),
                    $lt: moment(`${leaveYear}-${leaveMonth}-01`).endOf('month').toDate(),
                },
            },
            {
                // If leaveDays is empty, match by the startDate and endDate instead
                $and: [
                    { "leaveDays": { $size: 0 } },
                    { "startDate.date": { $gte: moment(`${leaveYear}-${leaveMonth}-01`).startOf('month').toDate() } },
                    { "endDate.date": { $lt: moment(`${leaveYear}-${leaveMonth}-01`).endOf('month').toDate() } }
                ]
            }
        ];
    }

    const pipeline = [
        // Stage 1: Match documents based on dynamic filters
        {
            $match: matchCondition,
        },
        // Stage 2: Conditionally unwind the leaveDays array (only if both leaveYear and leaveMonth are provided)
        ...(leaveYear && leaveMonth ? [
            {
                $unwind: "$leaveDays", // Unwind the leaveDays array
            }
        ] : []),
        // Stage 3: Match the month and year (if provided) for leaveDays.date
        ...(leaveYear && leaveMonth ? [
            {
                $match: {
                    $expr: {
                        $and: [
                            { $eq: [{ $month: "$leaveDays.date" }, parseInt(leaveMonth)] },  // Match month
                            { $eq: [{ $year: "$leaveDays.date" }, parseInt(leaveYear)] },   // Match year
                        ]
                    }
                },
            }
        ] : []),
        // Stage 4: Lookup to populate employee data from 'users' collection
        {
            $lookup: {
                from: 'users', // 'users' collection
                localField: 'employeeId',
                foreignField: 'uuid',  // Assuming 'uuid' is used to link to the Employee model
                as: 'employeeData',
            }
        },
        // Stage 5: Unwind the populated employeeData array
        {
            $unwind: {
                path: '$employeeData',
                preserveNullAndEmptyArrays: true,
            },
        },
        // Stage 6: Project required fields, including populated employee data
        {
            $project: {
                _id: 1,
                employeeId: 1,
                orgId: 1,
                leaveDays: 1,
                startDate: 1,
                endDate: 1,
                status: 1,
                reason: 1,
                createdAt: 1,
                updatedAt: 1,
                createdBy: 1,
                isDeleted: 1,
                uuid: 1,
                employeeName: '$employeeData.name',
                employeePosition: '$employeeData.position',
            },

        },
        // Stage 7: Use $facet to get both the total count and paginated data
        {
            $facet: {
                totalCount: [
                    { $count: "count" }
                ],
                data: [
                    // Skip and Limit for pagination
                    { $skip: Number(skip || 0) },
                    { $limit: Number(limit || 20) },
                ],
            },
        },
        // Stage 8: Sorting by createdAt (Descending)
        {
            $sort: { createdAt: -1 },
        },
    ];

    return pipeline;
}

