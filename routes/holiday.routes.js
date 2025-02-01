import { Router } from 'express';
import { addHoliday, deleteHolidays, getHolidaysByMonth, getHolidaysByYear } from '../controllers/holiday.controller.js';
import { adminGuard, authGuard } from '../middleware/auth.js';
const holidayRoutes = Router();

// Add a new holiday
holidayRoutes.post('/', authGuard, adminGuard, addHoliday);
// Get all holidays
holidayRoutes.get('/month', authGuard, getHolidaysByMonth);
// Delete holiday
holidayRoutes.delete('/:uuid', authGuard, deleteHolidays);
// Get holiday calendar
holidayRoutes.get('/year/:year', authGuard, getHolidaysByYear);

export default holidayRoutes;
