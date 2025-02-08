import moment from "moment/moment.js";
import { Attendance } from "../models/attendance.js";
import Employee from "../models/employee.js";
import { Regularization } from "../models/regularization.js";
import { dateQuery } from "./attendance.controller.js";

// Create a regularization request
export const createRegularizationRequest = async (req, res) => {
  const { attendanceDate, clockInTime, clockOutTime, reason } = req.body;
  const { uuid, orgId } = req.user;

  try {
    const isValidDate = !isNaN(Date.parse(attendanceDate)); // Basic date check
    if (!isValidDate) {
        message = 'Invalid date format.';
        return res.status(400).json({ data: null, message, success: false });
    }
    // Convert times to employee's timezone
    const user = await Employee.findOne({uuid, isActive: true});
    const timezone = user?.timezone || "UTC"; // default to UTC if no timezone info found

    const clockIn = moment.tz(clockInTime, timezone);
    const clockOut = moment.tz(clockOutTime, timezone);
    const attendance = moment.tz(attendanceDate, timezone);

    // Validate if the attendance date is a working day
    const isValidWorkingDay = isWorkingDay(user.workingDays, attendance);
    if (!isValidWorkingDay) {
      return res.status(400)
        .json({
          data: null,
          success: false,
          error: "The attendance date is not a valid working day.",
        });
    }

    // Verify the date and times align
    if (!attendance.isSame(clockIn, "day") || !attendance.isSame(clockOut, "day")) {
      return res.status(400)
        .json({
          data: null,
          success: false,
          error:
            "Clock-in time, clock-out time, and attendance date must be the same day.",
        });
    }

    const regularizationRequest = new Regularization({
      employeeId: uuid,
      createdBy: uuid,
      attendanceDate: new Date(attendanceDate),
      clockInTime: new Date(clockInTime),
      clockOutTime: new Date(clockOutTime),
      reason,
      orgId,
    });

    await regularizationRequest.save();
    return res.status(201).json({data: regularizationRequest, success: true, messaage: "Regularization requested successfully."});
  } catch (error) {
    return res.status(500).json({ message: error.message, error: error.message });
  }
};

export const requestList = async (req, res) => {
  try {
    const { skip=0, limit=20 } = req.query;
    const { uuid, role, orgId } = req.user;
    let query = {orgId};
    if(role !== 'admin') query = {createdBy: uuid, orgId};
    // Fetch the regularization request and populate the employee details
    let request = await Regularization.aggregate(aggregation(skip, limit, query));
    const totalCount = await Regularization.countDocuments(query);

    return res.status(200).json({
      success: true,
      message: "Request retrieved successfully.",
      data: {docs: request, totalCount},
    });
  } catch (error) {
    return res.status(500).json({ message: error.message, error: error.message || 'Something went wrong .' });
  }
};

export const changeRegularizationRequestStatus = async (req, res) => {
  const { requestId } = req.params;
  const { uuid, role, createdBy, orgId } = req.user;
  const { status } = req.body; // 'Approved', 'Rejected'
  let message = "Regularization request approved and attendance updated.";
  const validStatuses = ["Approved", "Rejected"];

  try {
    // Fetch the regularization request and populate the employee details
    const request = await Regularization.findOne({ uuid: requestId, orgId }).populate('employeeDetail');
    if (!request) {
      message = 'Regularization request not found.';
      return res.status(404).json({ status: false, message, error: message });
    }

    // Verify if the admin/HR is allowed to approve this request
    //   const employee = await Employee.findOne({uuid: request.employeeId});
    if ( orgId !== request.orgId) {
      return res.status(403).json({ error: 'Admin/HR verification failed.' });
    }

    if (request.status !== 'Pending'){
      message = "Unable to change status.";
      return res.status(400).json({ error: message, message });
    }

    if (!validStatuses.includes(status)) {
      message = "Invalid status.";
      return res.status(400).json({ success: false, error: message, message });
    }

    // Mark the request as approved
    request.status = status;
    await request.save();
    const attDate = new Date(request.attendanceDate);

    // Mark the old entry as invalid (or delete it if preferred)
    const existingAttendance = await Attendance.deleteMany({
      employeeId: request.employeeId,
      orgId,
      date: dateQuery(attDate.getFullYear(), attDate.getMonth()),
    });

    // Create new attendance record for the approved regularization
    const newAttendance = new Attendance({
      orgId,
      employeeId: request.employeeId,
      clockInTime: request.clockInTime,
      clockOutTime: request.clockOutTime,
      status: 'Present',
      totalHours: calculateTotalHours(request.clockInTime, request.clockOutTime),
      date: request.attendanceDate,
      regularization: true,
    });

    await newAttendance.save();

    // Return the newly created attendance record
    return res.status(200).json({
      success: true,
      message: 'Regularization request approved and attendance updated.',
      data: newAttendance,
    });
  } catch (error) {
    message = error.message || 'Something went wrong while approving the regularization request.';
    return res.status(500).json({ message, error: message });
  }
};

export const deleteRequest = async (req, res) => {
  let message = "Request deleted successfully.";
  try {
    const { requestId = "" } = req.params;
    const { uuid, orgId } = req.user;
    if (requestId.trim() === '') {
      message = "Request id is required.";
      return res.status(400).json({error: message, message });
    }
    const request = await Regularization.findOneAndDelete({uuid: requestId, createdBy: uuid, status: {$eq: 'Pending'}});
    if(!request) message = "User didn't matched or request\'s status changed.";
    return res.status(200).json({ message, success: true, data: request });
  } catch (error) {
    message = error.message || "Something went wrong while deleting regularization request.";
    return res.status(500).json({ message, error: message });
  }
}

function calculateTotalHours(clockIn, clockOut) {
    const diff = new Date(clockOut) - new Date(clockIn);
    return diff / 1000 / 60 / 60; // Convert milliseconds to hours
}

// Helper function to check if a date is a working day based on employee's working days
const isWorkingDay = async (userWorkingDays, date) => {
    // Assuming user has a 'workingDays' array (e.g., ['Monday', 'Tuesday', 'Wednesday', ...])
    const workingDays = userWorkingDays.map((day) => day.toLowerCase());
    const dayOfWeek = moment(date).format("dddd").toLowerCase();
    return workingDays.includes(dayOfWeek);
};


function aggregation(skip, limit, query={}) {
  return [
    {$match: query},
    {
      $lookup: {
        from: "users", // The collection to join with
        localField: "employeeId", // Field from the regularization collection
        foreignField: "uuid", // Field from the users collection (UUID)
        as: "employeeDetail", // Output array field
      },
    },
    { $unwind: "$employeeDetail" }, // Deconstruct the array created by $lookup
    {
      $project: { // Project the fields you need
        _id: 1,
        attendanceDate: 1,
        clockInTime: 1,
        clockOutTime: 1,
        reason: 1,
        status: 1,
        employeeId: 1,
        orgId: 1,
        uuid: 1,
        createdBy: 1,
        createdAt: 1,
        updatedAt: 1,
        isDeleted: 1,
        "employeeDetail.name": 1,
        "employeeDetail.email": 1,
        "employeeDetail.position": 1,
        // ... other fields from users
      },
    },
    { $skip: parseInt(skip) * parseInt(limit) },
    { $limit: parseInt(limit) },
    {
      $sort: { createdAt: -1 },
    },
  ]
}