import { Router } from 'express';
import { adminGuard, authGuard } from '../middleware/auth.js';
import { attendanceSummary, employeeAttendanceStatus, fetchMasterRecords, upcomingEvents } from '../controllers/dashboard.controller.js';
import { getActivityLogs } from '../controllers/activity.controller.js';

const dashboardRoutes = Router();
dashboardRoutes.get('/admin', authGuard, fetchMasterRecords);
dashboardRoutes.get('/attendance-summary', authGuard, attendanceSummary);
dashboardRoutes.get('/today-status', authGuard, employeeAttendanceStatus);
dashboardRoutes.post('/activity-log', authGuard, getActivityLogs);
dashboardRoutes.get('/upcoming-events', authGuard, upcomingEvents);

export default dashboardRoutes;
