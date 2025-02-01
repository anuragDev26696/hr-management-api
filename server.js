import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { config } from 'dotenv';
import connectDB from './config/db.config.js';
import authRoute from './routes/auth.routes.js';
import employeeRoute from './routes/employee.routes.js';
import departmentRoutes from './routes/department.routes.js';
import leaveRoutes from './routes/leave.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import holidayRoutes from './routes/holiday.routes.js';
const app = express();

config(); // configure dotenv
connectDB(); // Connect to MongoDB
const port = process.env.PORT || 2110;
// Middleware
app.use(bodyParser.json());
app.use(cors());
app.use('/api/auth', authRoute);
app.use('/api/user', employeeRoute);
app.use('/api/departments', departmentRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/holidays', holidayRoutes);
  
app.listen(port, () => {
    console.info(`Server running on ${port}.`);
});