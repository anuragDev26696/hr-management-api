import { Attendance } from "../models/attendance.js";
import Employee from "../models/employee.js";
import moment from "moment-timezone";
import { newLogActivity } from "./activity.controller.js";

// Clock-in an employee
const clockIn = async (req, res) => {
  try {
    const employeeId = req.user.uuid;
    const {orgId, role, name} = req.user;
    const startDayTime = moment().startOf('day').toDate();
    const endDayTime = moment().endOf('day').toDate();
    const clockInTime = new Date();
    // Query for an existing attendance record where clockOutTime is either null or undefined within the same month
    const exstingData = await Attendance.findOne({
      employeeId,
      orgId,
      clockOutTime: null, // Check if clockOutTime is null or undefined
      date: { $gte: startDayTime, $lte: endDayTime } // Check for the same month based on dateQuery
    });
    if(exstingData){
      return res.status(400).json({data: exstingData, error: 'Already clocked In.', message: 'Already clocked In.'});
    }
    const userData = await Employee.findOne({uuid: employeeId, orgId, isActive: true}, "joiningDate");
    if(moment(userData.joiningDate).isAfter(moment(clockInTime), 'date')){
      const msg = "You can't mark clockin before joining date.";
      return res.status(400).json({error: msg, message: msg});
    }
    const newAttendance = new Attendance({employeeId, orgId, date: startDayTime, clockInTime, createdBy: employeeId});
    await newAttendance.save();
    const formattedClockInTime = moment(clockInTime).format('hh:mm a');
    await newLogActivity(employeeId, role, name, 'Attendance', 'Clock in', orgId, `${name} clockin at ${formattedClockInTime}`);
    return res.status(201).json({data: newAttendance, success: true, message: 'Clock in successful.'});
  } catch (error) {
    return res.status(500).json({ error: error.message || error || "something went wrong", message: 'Error clocking in' });
  }
};

// Clock-out an employee
const clockOut = async (req, res) => {
  try {
    const employeeId = req.user.uuid;
    const {orgId, role, name} = req.user;
    const clockOutTime = new Date();
    // Ensure the date part is correct for today's date (ignoring time part)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0); // Start of today at midnight
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999); // End of today (just before midnight)
 
    // Find the latest attendance record for today where the clock-out is missing
    const attendance = await Attendance.findOne({
      employeeId,
      orgId,
      date: { $gte: todayStart, $lte: todayEnd },
      clockOutTime: { $in: [null, undefined] }, // Check for null or undefined clockOutTime
    }).sort({ clockInTime: -1 }); // Sort by clockInTime in descending order to get the most recent one

    if (!attendance) {
      return res.status(400).json({ message: 'No clock-in found for today' });
    }
    // Update the found attendance record with the clock-out time and calculate total hours
    attendance.clockOutTime = clockOutTime;
    attendance.totalHours = (clockOutTime - attendance.clockInTime) / (1000 * 60 * 60); // Calculate in hours
    await attendance.save();
    const formattedClockOutTime = moment(attendance.clockOutTime).format('hh:mm a');
    await newLogActivity(employeeId, role, name, 'Attendance', 'Clock out', orgId, `${name} clock out at ${formattedClockOutTime}`);
    return res.status(200).json({data: attendance.populate('employeeDetail'), success: true, message: 'Clocked out successfully.'});
  } catch (error) {
    return res.status(500).json({ error: error.message || error || "something went wrong", message: 'Error clocking out' });
  }
};

// Get attendance for a day
const getDayAttendance = async (req, res) => {
  try {
    const orgId = req.user.orgId;
    const dateFormat = new Date(req.params.date);
    const startTime = new Date(moment(dateFormat).startOf('date'))
    const endTime = new Date(moment(dateFormat).endOf('date'))
    let query = {orgId, date: {$gte: startTime, $lte: endTime}};
    const attendance = await Attendance.aggregate(attendAggregationQuery(query, 0, 1000));
    const totalCount = await Attendance.countDocuments(query);
    const message = totalCount > 0 ? "Attendance retrieved." : "Attendance not found for this day";
    return res.status(200).json({data: attendance[0], success: true, message});
  } catch (error) {
    return res.status(500).json({ error: error.message || error || "something went wrong", message: 'Error fetching attendance for the day' });
  }
};

// Get attendance for a day
const getEmployeeLatestAttendance = async (req, res) => {
  try {
    const { uuid, orgId } = req.user;
    const startDatetime = moment().startOf('day');
    const endDatetime = moment().endOf('day');
    const query = { clockOutTime: { $in: [null, undefined] }, date: {$gte: new Date(startDatetime), $lte: new Date(endDatetime)}, employeeId: uuid, orgId };
    const attendance = await Attendance.find(query).sort({createdAt: -1}).populate('employeeDetail').exec();
    return res.status(200).json({data: attendance[0] || null, success: true, message: attendance.length > 0 ? 'Attendance found.': 'Attendance not found.'});
  } catch (error) {
    return res.status(500).json({ error: error.message || error || "something went wrong", message: 'Error fetching attendance for the day' });
  }
};

// API to get today's attendance summary
export const attendanceSummary = async (req, res) => {
  try {
    // Define the late check-in threshold (e.g., after 9:30 AM)
    const LATE_CHECKIN_TIME = moment().set({ hour: 9, minute: 30, second: 0 });
    const {orgId} = req.user;
    const today =  moment().startOf('day').toDate();
    // Fetch attendance records & total employees in parallel
    const [attendances, totalEmployee] = await Promise.all([
      Attendance.find({ date: { $gte: today }, orgId: orgId }, "employeeId clockInTime"),
      Employee.countDocuments({ orgId: orgId, isActive: true }),
    ]);
    // Here we can use { employeeId: 1, clockInTime: 1, _id: 0 } for return limited fields
    // Here we can also use same like  "employeeId clockInTime" for return limited fields
    const presentEmployees = new Set();
    const lateClockins = new Set();
    attendances.forEach((item) => {
      if(!presentEmployees.has(item.employeeId) && item.clockInTime != null){
        presentEmployees.add(item.employeeId);
      }
      // Check if clock-in was late
      if (moment(item.clockInTime).isAfter(LATE_CHECKIN_TIME) && !lateClockins.has(item.employeeId)) {
        lateClockins.add(item.employeeId);
      }
    });
    const data = {
      present: presentEmployees.size,
      absent: totalEmployee - presentEmployees.size,
      lateCheckins: lateClockins.size,
    };
    return res.status(200).json({data, message: "Data retrived.", success: true});
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get attendance for a day with selected employees
const getEmployeesAttendance = async (req, res) => {
  try {
    const { date, employeeIds } = req.body;
    const { uuid, orgId } = req.user;
    const frmDate = new Date(date);
    let message = "";
    // Validation for employee id's
    if(!employeeIds || Array.isArray(employeeIds)){
      message = "EmployeeIds field is required and it should be an array.";
      return res.status(400).json({data: null, success: false, message});
    }
    // Validation for date
    const isValidDate = !isNaN(Date.parse(date)); // Basic date check
    if (!isValidDate) {
      message = 'Invalid date format.';
      return res.status(400).json({ data: null, message, success: false });
    }
    let query = {
      orgId,
      date: dateQuery(frmDate.getFullYear(), frmDate.getMonth()),
      employeeIds: {$in: {employeeIds}}
    };
    const attendance = await Attendance.find(query).sort({createdAt: -1}).populate('employeeDetail').exec();
    return res.status(200).json({data: attendance, success: true, message: 'Attendance retrieved.'});
  } catch (error) {
    return res.status(500).json({ error: error.message || error || "something went wrong", message: 'Error fetching attendance for the day' });
  }
};

// Get attendance for a month
const getAttendanceForMonth = async (req, res) => {
  try {
    const { year, month } = req.params;
    const { uuid, orgId } = req.user;
    let { employeeId = uuid } = req.query; // If employee id is in query otherwise it'll be requested user's id. 
    const dateRange = dateQuery(year, month, 'month');
    let reqQuery = {
      orgId,
      employeeId,
      date: dateRange,
    };
    const attendance = await Attendance.find(reqQuery).sort({date: -1});

    if (!attendance || attendance.length === 0) {
      return res.status(200).json({ message: 'No attendance found for this month' });
    }

    res.status(200).json({data: attendance, success: true, message: 'Attendance retrieved.'});
  } catch (error) {
    res.status(500).json({ error: error.message || error || "something went wrong", message: 'Error fetching attendance for the month' });
  }
};

// Mark absence or manually adjust clock-out time
const markAbsenceOrManualClockOut = async (req, res) => {
  try {
    const { employeeId, date, status, clockOutTime, clockInTime, timezone } = req.body;  // Include timezone in the request
    const adminId = req.user.uuid;
    const orgId = req.user.orgId;
    let message = "";

    // 1. Validate required fields
    if (!employeeId || !date || !status) {
      message = !employeeId ? "Employee Id is required." : !date ? 'Date is required.' : 'Status is required';
      return res.status(400).json({ data: null, message, success: false });
    }

    // 2. Validate status value
    if (!['present', 'absent'].includes(status.trim().toLowerCase())) {
      message = "Provide a valid status. Status should be 'Absent' or 'Present'.";
      return res.status(400).json({ data: null, message, success: false });
    }

    // 3. Validate clock-in and clock-out times when status is 'Present'
    if (status === 'Present' && (!clockOutTime || !clockInTime)) {
      message = 'Clock in and clock out time are required for marking present.';
      return res.status(400).json({ data: null, message, success: false });
    }

    // 4. Validate the date format
    const isValidDate = !isNaN(Date.parse(date)); // Basic date check
    if (!isValidDate) {
      message = 'Invalid date format.';
      return res.status(400).json({ data: null, message, success: false });
    }

    // 5. Prevent future dates for attendance marking
    const attendanceDate = moment(date).startOf('day'); // Start of the day
    const currentDate = moment().startOf('day'); // Current date at midnight (local time)

    if (attendanceDate.isAfter(currentDate)) {
      message = 'Attendance cannot be marked for a future date.';
      return res.status(400).json({ data: null, message, success: false });
    }

    // 6. Validate employee existence
    const employee = await Employee.findOne({employeeId, orgId}); // Assuming `Employee` is the model
    if (!employee) {
      message = 'Employee does not exist.';
      return res.status(404).json({ data: null, message, success: false });
    }

    // 7. Validate clock-in and clock-out time format (HH:mm)
    if (!/^\d{2}:\d{2}$/.test(clockInTime) || !/^\d{2}:\d{2}$/.test(clockOutTime)) {
      message = 'Invalid time format. Use HH:mm format for clock-in and clock-out.';
      return res.status(400).json({ data: null, message, success: false });
    }

    // 8. Validate clock-in time is earlier than clock-out time
    const formattedClockInTime = moment.tz(`${attendanceDate.format('YYYY-MM-DD')} ${clockInTime}`, timezone || 'UTC').startOf('minute');
    const formattedClockOutTime = moment.tz(`${attendanceDate.format('YYYY-MM-DD')} ${clockOutTime}`, timezone || 'UTC').startOf('minute');

    if (formattedClockInTime.isSameOrAfter(formattedClockOutTime)) {
      message = 'Clock-out time must be later than clock-in time.';
      return res.status(400).json({ data: null, message, success: false });
    }

    // 9. Handle query for existing attendance records
    const query = { employeeId, orgId, date: dateQuery(attendanceDate.year(), attendanceDate.month()) };

    if (status === 'Absent') {
      // 10. Mark as absent (update attendance status)
      await Attendance.updateMany(query, { $set: { status: 'Absent' } });
      return res.status(200).json({ data: {}, success: true, message: 'Employee marked as absent.' });
    } else {
      // 11. Mark as present (delete previous records and insert new)
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        // 12. Ensure no duplicate entries exist for the same day
        await Attendance.deleteMany(query, { session });

        // 13. Create attendance record
        const attendance = new Attendance({
          employeeId,
          orgId,
          date: attendanceDate.toDate(),
          status: 'Present',
          clockInTime: formattedClockInTime.toDate(),
          clockOutTime: formattedClockOutTime.toDate(),
          createdBy: adminId,
          totalHours: formattedClockOutTime.diff(formattedClockInTime, 'hours', true), // Total hours worked
        });

        await attendance.save({ session });
        await session.commitTransaction();
        session.endSession();

        return res.status(200).json({ data: attendance, success: true, message: 'Marked as present.' });
      } catch (error) {
        await session.abortTransaction();
        session.endSession();
        message = 'Failed to process attendance.';
        return res.status(500).json({ data: null, message: error.message || 'Error during attendance update', success: false });
      }
    }
  } catch (error) {
    // 14. General error handler
    res.status(500).json({ error: error.message || "Something went wrong", message: 'Error marking absence or adjusting time' });
  }
};

export const dateQuery = (year, month, title = null) => {
  let startDate = moment(new Date(year, month, 1)); // Start of the month  
  let endDate = moment(startDate).endOf('month'); // Last day of the month

  return { $gte: new Date(startDate), $lte: new Date(endDate) };
};


function attendAggregationQuery( query, skip, limit ) {
  const pipeline = [
    // Stage 1: Match documents based on dynamic filters
    { $match: query },
    // Stage 2: Lookup to populate employee data from 'users' collection
    {
      $lookup: {
        from: 'users', // 'users' collection
        localField: 'employeeId',
        foreignField: 'uuid',  // Assuming 'uuid' is used to link to the Employee model
        as: 'employeeData',
      }
    },
    // Stage 3: Unwind the populated employeeData array
    {
      $unwind: {
        path: '$employeeData',
        preserveNullAndEmptyArrays: true,
      },
    },
    // Stage 4: Project required fields, including populated employee data
    {
      $project: {
        _id: 1,
        employeeId: 1,
        orgId: 1,
        clockOutTime: 1,
        clockInTime: 1,
        status: 1,
        date: 1,
        createdAt: 1,
        updatedAt: 1,
        createdBy: 1,
        isDeleted: 1,
        totalHours: 1,
        uuid: 1,
        regularization: 1,
        employeeName: '$employeeData.name',
        employeePosition: '$employeeData.position',
      },
    },
    // Stage 5: Use $facet to get both the total count and paginated data
    {
      $facet: {
        totalCount: [
          { $count: "count" }
        ],
        docs: [
          // Skip and Limit for pagination
          { $skip: Number(skip || 0) },
          { $limit: Number(limit || 20) },
        ],
      },
    },
    // Stage 6: Unwind the totalCount to get it as a number
    {
      $project: {
        totalCount: { $arrayElemAt: ["$totalCount.count", 0] }, // Get count as a number
        docs: 1,
      },
    },
    // Stage 7: Sorting by createdAt (Descending)
    {
      $sort: { createdAt: -1 },
    },
  ];
  return pipeline;
}

export { clockIn, clockOut, getDayAttendance, getAttendanceForMonth, markAbsenceOrManualClockOut, getEmployeesAttendance, getEmployeeLatestAttendance };
