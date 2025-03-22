import { Router } from 'express';
import { adminGuard, authGuard } from '../middleware/auth.js';
import { attendanceSummary, fetchMasterRecords } from '../controllers/dashboard.controller.js';
import { getActivityLogs } from '../controllers/activity.controller.js';

const dashboardRoutes = Router();
dashboardRoutes.get('/admin', authGuard, fetchMasterRecords);
dashboardRoutes.get('/attendance-summary', authGuard, attendanceSummary);
dashboardRoutes.post('/activity-log', authGuard, getActivityLogs);

export default dashboardRoutes;
