import moment from "moment";
import { Attendance } from "../models/attendance.js";
import Employee from "../models/employee.js";
import Department from "../models/department.js";
import LeaveRequest from "../models/leave.js";
import { LeaveBalance } from "../models/leaveBalance.js";
import { Holiday } from "../models/holiday.js";

// API to get master records
export const fetchMasterRecords = async (req, res) => {
  try {
    const { orgId, role } = req.user;
    const previousMonth = moment().subtract(1, 'month').startOf('month').toDate();
    const [departments, totalEmployee, activeEmployee, recentRegistrations, leaveRequest] = await Promise.all([
      Department.countDocuments({ isActive: true }),
      Employee.countDocuments({ orgId: orgId }),
      Employee.countDocuments({ orgId: orgId, isActive: true }),
      Employee.countDocuments({ orgId: orgId, createdAt:  {$gte: previousMonth}}),
      LeaveRequest.countDocuments({ orgId: orgId, status: 'pending' }),
    ]);
    const data = {
        departments,
        totalEmployee,
        activeEmployee,
        recentRegistrations,
        leaveRequest,
    };
    return res
      .status(200)
      .json({ data, message: "Data retrived.", success: true });
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// API to get today's attendance summary
export const attendanceSummary = async (req, res) => {
  try {
    // Define the late check-in threshold (e.g., after 9:30 AM)
    const LATE_CHECKIN_TIME = moment().set({ hour: 9, minute: 30, second: 0 });
    const { orgId } = req.user;
    const today = moment().startOf("day").toDate();
    // Fetch attendance records & total employees in parallel
    const [attendances, totalEmployee, leaveRequest] = await Promise.all([
      Attendance.find(
        { date: { $gte: today }, orgId: orgId },
        "employeeId clockInTime"
      ),
      Employee.countDocuments({ orgId: orgId, isActive: true }),
      LeaveRequest.countDocuments({ orgId: orgId, status: 'pending' }),
    ]);
    // Here we can use { employeeId: 1, clockInTime: 1, _id: 0 } for return limited fields
    // Here we can also use same like  "employeeId clockInTime" for return limited fields
    const presentEmployees = new Set();
    const lateClockins = new Set();
    attendances.forEach((item) => {
      if (!presentEmployees.has(item.employeeId) && item.clockInTime != null) {
        presentEmployees.add(item.employeeId);
      }
      // Check if clock-in was late
      if (
        moment(item.clockInTime).isAfter(LATE_CHECKIN_TIME) &&
        !lateClockins.has(item.employeeId)
      ) {
        lateClockins.add(item.employeeId);
      }
    });
    const data = {
      present: presentEmployees.size,
      absent: totalEmployee - presentEmployees.size,
      lateCheckins: lateClockins.size,
      leaveRequest
    };
    return res
      .status(200)
      .json({ data, message: "Data retrived.", success: true });
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
// API to get employee's today's attendance status
export const employeeAttendanceStatus = async (req, res) => {
  try {
    const {name, uuid, role, orgId} = req.user;
    const today = moment().startOf("day").toDate();
    const monthStart = moment().startOf("month").toDate();
    const monthEnd = moment().endOf("month").toDate();
    const [attendanceDocs, monthTotalPresent, leaveRequest, leaveBalanceDoc] = await Promise.all([
      Attendance.findOne(
        { date: { $gte: today }, orgId: orgId, employeeId: uuid },
        "clockOutTime clockInTime totalHours"
      ),
      Attendance.distinct("date", { date: { $gte: monthStart, $lte: monthEnd }, orgId: orgId, employeeId: uuid }),
      LeaveRequest.countDocuments({ orgId: orgId, employeeId: uuid, status: 'pending' }),
      LeaveBalance.findOne({employeeId: uuid}, "remainingCL appliedCL appliedLOP")
    ]);
    const data = {
      todayAttendance: attendanceDocs,
      monthAttendance: monthTotalPresent.length,
      leaveRequest,
      leaveBalanceDoc
    };
    return res
      .status(200)
      .json({ data, message: "Data retrived.", success: true });
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const upcomingEvents = async (req, res) => {
  let message = "Data found";
  try {
    const { orgId, role, name } = req.user;
    const today = moment().startOf("day").toDate();
    const todayMonthDay = moment().format("MM-DD");
    const birthExp =  {
      $expr: {
        $eq: [
          { $dateToString: { format: "%m-%d", date: "$dateOfBirth" } }, // Extract MM-DD
          todayMonthDay
        ]
      }
    };
    const [holidays, birthdays] = await Promise.all([
      Holiday.findOne({orgId, date: {$gte: today}}, "name date holidayType").sort({date: 1}),
      Employee.find({orgId, isActive: true, ...birthExp}, "dateOfBirth name")
    ]);

    return res.status(200).json({ data: {holidays, birthdays}, success: true, message });
  } catch (error) {
    message = "Error fetching activity logs"
    return res.status(500).json({ error: error.message ?? error, message });
  }
};