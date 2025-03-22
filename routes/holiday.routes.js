import { Router } from 'express';
import { addHoliday, deleteHolidays, getHolidaysByMonth, getHolidaysByYear, updateHoliday } from '../controllers/holiday.controller.js';
import { adminGuard, authGuard, checkPermission } from '../middleware/auth.js';
const holidayRoutes = Router();

// Add a new holiday
holidayRoutes.post('/', authGuard, checkPermission("holiday"), addHoliday);
// Get all holidays
holidayRoutes.get('/month', authGuard, getHolidaysByMonth);
// Delete holiday
holidayRoutes.patch('/:uuid', authGuard, updateHoliday);
// Delete holiday
holidayRoutes.delete('/:uuid', authGuard, checkPermission("holiday"), deleteHolidays);
// Get holiday calendar
holidayRoutes.get('/year/:year', authGuard, getHolidaysByYear);

export default holidayRoutes;
