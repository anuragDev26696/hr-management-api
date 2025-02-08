import express from 'express';
import { changeRegularizationRequestStatus, createRegularizationRequest, deleteRequest, requestList } from '../controllers/regularization.controller.js';
import { adminGuard, authGuard } from '../middleware/auth.js';

const regularizationRoutes = express.Router();

// Route to create a regularization request
regularizationRoutes.post('/create', authGuard, createRegularizationRequest);
// Get requested list for admin
regularizationRoutes.get('/requests', authGuard, requestList);
// Route to delete regularization request
regularizationRoutes.delete('/:requestId', authGuard, deleteRequest);
// Route to update the status of the regularization request
regularizationRoutes.patch('/:requestId/status', authGuard, adminGuard, changeRegularizationRequestStatus);

export default regularizationRoutes;
