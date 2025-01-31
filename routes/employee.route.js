import express from 'express';
import { newUser, getAll, getUser, updateUser } from '../controllers/employee.js';
import { adminGuard, authGuard } from '../middleware/auth.js';

const employeeRoute = express.Router();
employeeRoute.post('/', adminGuard, newUser);
employeeRoute.patch('/:userId', updateUser);
employeeRoute.get('/', authGuard, getAll);
employeeRoute.get('/:userId', authGuard, getUser);
// employeeRoute.delete('/:userId', deleteSingleUser);
export default employeeRoute;