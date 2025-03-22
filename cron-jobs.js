import { schedule } from 'node-cron';
import moment from 'moment';
import Employee from './models/employee.js';
import { LeaveBalance } from './models/leaveBalance.js';
import { Holiday } from './models/holiday.js';
import { deleteOldActivities } from './controllers/activity.controller.js';

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

  // Fetch all active employees
  const activeEmployees = await Employee.find({ isActive: true });
    
  // If it's January, create new records for each active employee
  if (currentMonth === 0) {
    for (const emp of activeEmployees) {
      const leaveDoc = await LeaveBalance.findOne({employeeId: emp.uuid, orgId: emp.orgId});
      if (!leaveDoc) continue; // Skip if no leave record found
      leaveDoc.leaveHistory.push(
        {
          year: moment().subtract(1, 'year').startOf('year').toDate(),
          appliedCL: leaveDoc.appliedCL,
          appliedLOP: leaveDoc.appliedLOP,
          remainedCL: leaveDoc.remainingCL
        }
      );
      leaveDoc.lastCreditDate = new Date().toUTCString(),
      leaveDoc.appliedCL = 0;
      leaveDoc.appliedLOP = 0;
      leaveDoc.remainingCL = (leaveDoc.remainingCL || 0) + 1.5;
      await leaveDoc.save(); 
    }
    console.log('Created new leave balances for active employees in January.');
    return;
  }

  // Update monthly leave balance for employees who haven't been updated yet
  const updatedEmployees = await LeaveBalance.find({
    lastCreditDate: { $gte: preMonthStartDate, $lte: preMonthEndDate },
  }).distinct("employeeId");

  const employeesToUpdate = activeEmployees.filter(emp => !updatedEmployees.includes(emp.uuid));

  await LeaveBalance.updateMany(
    { employeeId: {$in: employeesToUpdate.map(emp => emp.uuid)} },
    {
      $set: {lastCreditDate: monthStartDate},
      $inc: { lastCreditedCL: 1.5, remainingCL: 1.5 },
    }
  );
  console.log('Leave balance updated for employees who have not been updated.');
  await deleteOldActivities();
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