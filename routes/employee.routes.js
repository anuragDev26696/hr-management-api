import express from 'express';
import { newUser, getAll, getUser, updateUser, updateWorkingDays, deleteAll, deleteSingleUser } from '../controllers/employee.controller.js';
import { adminGuard, authGuard } from '../middleware/auth.js';

const employeeRoute = express.Router();
employeeRoute.post('/', authGuard, adminGuard, newUser);
employeeRoute.patch('/:userId', authGuard, updateUser);
employeeRoute.get('/', authGuard, getAll);
employeeRoute.get('/:userId', authGuard, getUser);
employeeRoute.delete('/:userId', authGuard, adminGuard, deleteSingleUser);
employeeRoute.put('/deleteAll', authGuard, adminGuard, deleteAll);
employeeRoute.patch('/updateWorkingDays/:userId', authGuard, adminGuard, updateWorkingDays);
export default employeeRoute;