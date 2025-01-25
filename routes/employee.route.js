import express from 'express';
import { newUser, getAll } from '../controllers/employee.js';
import { adminGuard } from '../middleware/auth.js';

const employeeRoute = express.Router();
employeeRoute.post('/', adminGuard, newUser, async (req, res) => {
    console.log(req.path.includes('/register'))
});
// employeeRoute.patch('/:userId', newUser);
employeeRoute.get('/', getAll);
// employeeRoute.get('/:userId', getSingleUser);
// employeeRoute.delete('/:userId', deleteSingleUser);
export default employeeRoute;