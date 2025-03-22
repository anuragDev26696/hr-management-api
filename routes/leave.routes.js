import express from 'express';
import { authGuard, checkPermission } from "../middleware/auth.js";
import { applyLeave, cancelLeave, getLeaves, getLeaveStatus, monthlyLeaves, updateStatus } from '../controllers/leave.controller.js';

const router = express.Router();

// Create a leave request
router.post('/apply-leave', authGuard, applyLeave);
router.patch('/:id', authGuard, getLeaves);
router.get('/leave-balance', authGuard, getLeaveStatus);
router.post('/update-leave-status', authGuard, checkPermission("leave"), updateStatus);
router.delete('/cancel/:id', authGuard, cancelLeave);
router.post('/filter', authGuard, getLeaves);
router.post('/month-leave', authGuard, monthlyLeaves);

const leaveRoutes = router;
export default leaveRoutes;