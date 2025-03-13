import { schedule } from 'node-cron';
import moment from 'moment';
import Employee from './models/employee.js';
import { LeaveBalance } from './models/leaveBalance.js';
import { Holiday } from './models/holiday.js';

// Function to check if the 1st January is a holiday or weekend
const isHolidayOrWeekend = async (date) => {
  const dayOfWeek = moment(date).day(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday or Saturday
    return true;
  }
  
  const startDate = moment(date).startOf('month');
  const endDate = moment(date).endOf('month');
  const holidays = await Holiday.find({ date: {$gte: new Date(startDate), $lte: new Date(endDate)} });

  // Check if the date is a holiday (assuming holidays API returns list of holidays)
  return holidays.some(holiday => moment(holiday.date).isSame(date, 'day'));
};

// Main function to update LeaveBalance for all employees
const updateLeaveBalance = async () => {
  const currentYear = moment().year();
  const firstDayOfYear = moment(`${currentYear}-01-01`);

  // If today is a Sunday or a holiday, check the next working day
  if (await isHolidayOrWeekend(firstDayOfYear)) {
    let nextWorkingDay = firstDayOfYear.clone().add(1, 'days').isoWeekday(1); // Move to next Monday if Sunday or Holiday
    while (await isHolidayOrWeekend(nextWorkingDay)) {
      nextWorkingDay = nextWorkingDay.clone().add(1, 'days').isoWeekday(1); // Keep moving until it's a working day
    }
    console.log(`Today is a holiday or weekend, updating on next working day: ${nextWorkingDay.format('YYYY-MM-DD')}`);
    // Schedule a new cron job for the next working day
    scheduleLeaveBalanceUpdate(nextWorkingDay);
    return; // We won't update today, will reschedule for next working day
  }

  // Get all employees who haven't been updated this year
  const updatedEmployees = await LeaveBalance.find({ updatedAt: { $gte: firstDayOfYear } });
  const updatedEmployeeIds = updatedEmployees.map(emp => emp.employeeId);

  // Get all employees who need their leave balance updated
  const employees = await Employee.find({
    uuid: { $nin: updatedEmployeeIds },
  });

  for (const employee of employees) {
    // Calculate remaining LOP leaves for the year
    const remainingDays = moment(`${currentYear}-12-31`).diff(moment(employee.joiningDate), 'days');
    const totalDaysInYear = moment(`${currentYear}-12-31`).diff(moment(`${currentYear}-01-01`), 'days') + 1; // Include today
    const remainingLopLeaves = (remainingDays / totalDaysInYear) * 365;

    // Create or update the LeaveBalance for the employee
    const leaveBalance = new LeaveBalance({
      employeeId: employee.uuid,
      orgId: employee.orgId,
      lastCreditDate: new Date().toUTCString(),
      appliedLopLeaves: 0,
      remainingLopLeaves,
      totalLopLeaves: 0,
      appliedCasualLeaves: 0,
      remainingCasualLeaves: 1.5,
    });

    await leaveBalance.save();
  }

  console.log('Leave balance updated for employees who have not been updated.');
};

// Function to update LeaveBalance for all employees monthly
const updateMonthlyLeave = async (date) => {
  const currentDate = moment(date);
  const currentMonth = currentDate.month(); // 0-based (0 = January, 11 = December)
  const monthStartDate = currentDate.startOf('month').toDate(); // Start of the current month
  const preMonthStartDate = currentDate.clone().subtract(1, 'month').startOf('month').toDate();
  const preMonthEndDate = currentDate.clone().subtract(1, 'month').endOf('month').toDate();

  // Check if the current date is a holiday or weekend
  if (await isHolidayOrWeekend(currentDate)) {
    let nextWorkingDay = currentDate.clone().add(1, 'days').isoWeekday(1); // Move to next Monday if Sunday or Holiday
    while (await isHolidayOrWeekend(nextWorkingDay)) {
      nextWorkingDay = nextWorkingDay.clone().add(1, 'days').isoWeekday(1); // Keep moving until it's a working day
    }
    console.log(`Today is a holiday or weekend, updating on next working day: ${nextWorkingDay.format('YYYY-MM-DD')}`);
    scheduleLeaveBalanceUpdate(nextWorkingDay);
    return;
  }

  // If it's January, create new records for each active employee
  if (currentMonth === 0) {
    const activeEmployees = await Employee.find({ isActive: true });
    for (const emp of activeEmployees) {
      const newLeaveBalance = new LeaveBalance({
        employeeId: emp.uuid,
        orgId: emp.orgId,
        lastCreditDate: new Date(monthStartDate),
        appliedLopLeaves: 0,
        remainingLopLeaves: 0,
        totalLopLeaves: 0,
        appliedCasualLeaves: 0,
        remainingCasualLeaves: 1.5,
        creditedCasualLeaves: 1.5,
      });
      await newLeaveBalance.save();
    }
    console.log('Created new leave balances for active employees in January.');
    return;
  }

  // Get all leaveBalance records for the previous month
  const leaveBalanceDocs = await LeaveBalance.find({
    lastCreditDate: { $gte: preMonthStartDate, $lte: preMonthEndDate },
  });
  const updatedEmployeeIds = leaveBalanceDocs.map((emp) => emp.employeeId);
  // Get all active employees who haven't been updated yet this month
  const employees = await Employee.find({ uuid: { $nin: updatedEmployeeIds }, isActive: true });

  for (const leave of leaveBalanceDocs) {
    const emp = employees.find((item) => item.uuid === leave.employeeId);
    if (emp) {
      const reqData = { 
        lastCreditDate: monthStartDate,
        creditedCasualLeaves: leave.creditedCasualLeaves + 1.5,
        remainingCasualLeaves: leave.remainingCasualLeaves +1.5, 
      };
      await LeaveBalance.findOneAndUpdate(
        { uuid: leave.uuid, employeeId: emp.uuid },
        { $set: reqData }
      );
    }
  }

  console.log('Leave balance updated for employees who have not been updated.');
};

// Function to schedule the leave balance update on a specific date
const scheduleLeaveBalanceUpdate = (date) => {
  // Schedule the cron job to run on the specified date at midnight
  schedule(`0 0 ${date.date()} ${date.month() + 1} *`, async () => {
    try {
      // await updateLeaveBalance();
      await updateMonthlyLeave(date);
    } catch (err) {
      console.error('Error updating leave balances:', err);
    }
  });
};

// Schedule the cron job to run on the 1st of January each year at midnight
// schedule('0 0 1 1 *', async () => {
//   try {
//     await updateLeaveBalance();
//   } catch (err) {
//     console.error('Error updating leave balances:', err);
//   }
// });

// // If the cron job is canceled, we can just add a fallback to retry the next day
// schedule('0 0 * * *', async () => {
//   const today = moment().format('YYYY-MM-DD');
//   // Check if today is 1st of January and cron job was missed due to some reason
//   if (today === moment().year() + '-01-01') {
//     try {
//       await updateLeaveBalance();
//     } catch (err) {
//       console.error('Error in retrying leave balance update:', err);
//     }
//   }
// });

// Initial scheduling for the 1st of ever month
scheduleLeaveBalanceUpdate(moment().startOf('month'));
// Initial scheduling for the 1st of January
// scheduleLeaveBalanceUpdate(moment().startOf('year'));