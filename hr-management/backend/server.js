import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { config } from 'dotenv';
import connectDB from './config/db.config.js';
import authRoute from './routes/auth.route.js';
import employeeRoute from './routes/employee.route.js';
const app = express();

config(); // configure dotenv
connectDB(); // Connect to MongoDB
const port = process.env.PORT || 2110;
// Middleware
app.use(bodyParser.json());
app.use(cors());
app.use('/api/auth', authRoute);
app.use('/api/user', employeeRoute);
app.post('/test', (req, res) => {
    // console.log('Test Body:', req.body);
    res.send('Test route');
});
  
app.get('/', (req, res) => {
    res.send("Hello world!");
});
app.listen(port, () => {
    console.info(`Server running on ${port}.`);
});