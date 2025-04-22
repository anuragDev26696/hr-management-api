import express from 'express';
import { authGuard, checkPermission } from "../middleware/auth.js";
import { adminUpdateRemarkAndStatus, deleteTimesheet, downloadExcel, findSingleTimesheet, getTimeSheetByMonth, submitNew, updateTimesheet } from '../controllers/timesheet.controller.js';

const router = express.Router();

router.post('/create-new', authGuard, submitNew);
router.get('/:timesheetId', authGuard, findSingleTimesheet);
router.patch('/:timesheetId', authGuard, updateTimesheet);
router.post('/filter/month', authGuard, getTimeSheetByMonth);
router.delete('/:timesheetId', authGuard, deleteTimesheet);
router.patch('/remark/:timesheetId', authGuard, checkPermission("project"), adminUpdateRemarkAndStatus);
router.post('/download/excel', authGuard, downloadExcel);

const timesheetRoutes = router;
export default timesheetRoutes;