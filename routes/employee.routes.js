import express from 'express';
import { newUser, getAll, getUser, updateUser, updateWorkingDays, deleteAll, deleteSingleUser } from '../controllers/employee.controller.js';
import { authGuard, checkPermission } from '../middleware/auth.js';

const employeeRoute = express.Router();
employeeRoute.post('/', authGuard, checkPermission("employee"), newUser);
employeeRoute.patch('/:userId', authGuard, updateUser);
employeeRoute.get('/', authGuard, getAll);
employeeRoute.get('/:userId', authGuard, getUser);
employeeRoute.delete('/:userId', authGuard, checkPermission("employee"), deleteSingleUser);
employeeRoute.put('/deleteAll', authGuard, checkPermission("employee"), deleteAll);
employeeRoute.patch('/updateWorkingDays/:userId', authGuard, checkPermission("employee"), updateWorkingDays);
export default employeeRoute;