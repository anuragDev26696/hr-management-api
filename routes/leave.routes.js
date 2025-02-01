import express from 'express';
import { adminGuard, authGuard } from "../middleware/auth.js";
import { applyLeave, cancelLeave, getLeaves, monthlyLeaves, updateStatus } from '../controllers/leave.controller.js';

const router = express.Router();

// Create a leave request
router.post('/apply-leave', authGuard, applyLeave);
router.patch('/:id', authGuard, getLeaves);
router.post('/update-leave-status', authGuard, adminGuard, updateStatus);
router.delete('/cancel/:id', authGuard, cancelLeave);
router.post('/filter', authGuard, getLeaves);
router.post('/month-leave', authGuard, monthlyLeaves);

const leaveRoutes = router;
export default leaveRoutes;