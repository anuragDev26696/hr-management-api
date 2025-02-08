import { Attendance } from "../models/attendance.js";
import Employee from "../models/employee.js";
import moment from "moment-timezone";

// Clock-in an employee
const clockIn = async (req, res) => {
  try {
    const employeeId = req.user.uuid;
    const orgId = req.user.orgId;
    const clockInTime = new Date();
    const exstingData = await Attendance.findOne({employeeId, orgId, clockOutTime: {$in: [null, undefined], date: dateQuery(clockInTime.getFullYear(), clockInTime.getMonth())}});
    if(exstingData){
      res.status(400).json({data: exstingData, success: true, message: 'Already clocked In.'});
    }
    const newAttendance = new Attendance({employeeId, orgId, clockInTime, createdBy: employeeId});
    await newAttendance.save();
    res.status(201).json({data: newAttendance, success: true, message: 'Clock in successful.'});
  } catch (error) {
    res.status(500).json({ error: error.message || error || "something went wrong", message: 'Error clocking in' });
  }
};

// Clock-out an employee
const clockOut = async (req, res) => {
  try {
    const employeeId = req.user.uuid;
    const orgId = req.user.orgId;
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
    res.status(200).json({data: attendance.populate('employeeDetail'), success: true, message: 'Clocked out successfully.'});
  } catch (error) {
    res.status(500).json({ error: error.message || error || "something went wrong", message: 'Error clocking out' });
  }
};

// Get attendance for a day
const getDayAttendance = async (req, res) => {
  try {
    const orgId = req.user.orgId;
    const { date = new Date(), employeeId } = req.params;
    const attendance = await Attendance.find({ orgId, date: new Date(date) }).sort({createdAt: -1}).populate('employeeDetail').exec();
    const totalCount = await Attendance.countDocuments({ date: new Date(date) });
    const message = totalCount > 0 ? "Attendance retrieved." : "Attendance not found for this day";
    res.status(200).json({data: {docs: attendance, totalCount}, success: true, message});
  } catch (error) {
    res.status(500).json({ error: error.message || error || "something went wrong", message: 'Error fetching attendance for the day' });
  }
};

// Get attendance for a day
const getEmployeeLatestAttendance = async (req, res) => {
  try {
    const { uuid, orgId } = req.user;
    const today = new Date();
    const attendance = await Attendance.find({ date: dateQuery(today.getFullYear(), today.getMonth()), employeeId: uuid, orgId }).sort({createdAt: -1}).populate('employeeDetail').exec();
    res.status(200).json({data: attendance[0] || null, success: true, message: attendance.length > 0 ? 'Attendance found.': 'Attendance not found.'});
  } catch (error) {
    res.status(500).json({ error: error.message || error || "something went wrong", message: 'Error fetching attendance for the day' });
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
      res.status(400).json({data: null, success: false, message});
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
    res.status(200).json({data: attendance, success: true, message: 'Attendance retrieved.'});
  } catch (error) {
    res.status(500).json({ error: error.message || error || "something went wrong", message: 'Error fetching attendance for the day' });
  }
};

// Get attendance for a month
const getAttendanceForMonth = async (req, res) => {
  try {
    const { month, year } = req.params;
    const { uuid, orgId } = req.user;
    let { employeeId = uuid } = req.query; // If employee id is in query otherwise it'll be requested user's id. 

    const attendance = await Attendance.find({
      orgId,
      employeeId,
      date: dateQuery(year, month),
    }).sort({date: -1});

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

export function dateQuery(year, month) {
  const startDate = new Date(year, month, 1); // Start of the month
  const endDate = new Date(year, month+1, 0, 23, 59, 59); // End of the month
  return { $gte: startDate, $lte: endDate };
}

export { clockIn, clockOut, getDayAttendance, getAttendanceForMonth, markAbsenceOrManualClockOut, getEmployeesAttendance, getEmployeeLatestAttendance };
