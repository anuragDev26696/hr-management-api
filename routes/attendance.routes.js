import { Router } from 'express';
import { clockIn, clockOut, getAttendanceForDay, getAttendanceForMonth, markAbsenceOrManualClockOut } from '../controllers/attendance.controller.js';
import { adminGuard, authGuard } from '../middleware/auth.js';

const attendanceRoutes = Router();
// Clock in
attendanceRoutes.post('/clockin', authGuard, clockIn);
// Clock out
attendanceRoutes.put('/clockout', authGuard, clockOut);
// Get attendance for a day
attendanceRoutes.get('/day/:date', authGuard, adminGuard, getAttendanceForDay);
// Get attendance for a month
attendanceRoutes.get('/month/:month/:year', authGuard, getAttendanceForMonth);
// Mark absence or adjust clock-out time
attendanceRoutes.put('/manual', authGuard, adminGuard, markAbsenceOrManualClockOut);

export default attendanceRoutes;
