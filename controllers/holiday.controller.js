import { Holiday } from "../models/holiday.js";
import moment from "moment";

// Add a new holiday
const addHoliday = async (req, res) => {
  try {
    const { name, date, holidayType } = req.body;
    const { uuid } = req.user;
    let message = "";

    // 1. Validate that the date is a valid date format using Moment.js
    const parsedDate = moment(date, 'YYYY-MM-DD', true); // Expecting date format 'YYYY-MM-DD'
    if (!parsedDate.isValid()) {
      message = 'Invalid date format. Please use YYYY-MM-DD format.';
      return res.status(400).json({ data: null, message, success: false });
    }

    // 2. Ensure the holiday date is not in the past
    if (parsedDate.isBefore(moment(), 'day')) { // Check if the holiday is in the past
      message = 'Holiday date cannot be in the past.';
      return res.status(400).json({ data: null, message, success: false });
    }

    // 3. Create the new holiday entry
    const newHoliday = new Holiday({
      name,
      date: parsedDate.toDate(), // Convert to JavaScript Date object before saving
      holidayType,
      createdBy: uuid,
    });

    await newHoliday.save();
    res.status(201).json({ data: newHoliday, success: true, message: 'Holiday created successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message, message: 'Error adding holiday' });
  }
};

// Delete holiday
const deleteHolidays = async (req, res) => {
  try {
    const holiday = await Holiday.findOneAndDelete({uuid: req.params.uuid});
    res.status(200).json({data: holiday, success: true, message: 'Event deleted successfully.'});
  } catch (error) {
    res.status(500).json({error: error.message, message: 'Error fetching holiday' });
  }
};

// Get holidays for a specific month (e.g., "MM" format)
const getHolidaysByMonth = async (req, res) => {
  try {
    const { year, month } = req.query; // Expecting year and month in query params (e.g., /holidays?year=2025&month=02)
    let message = "";

    // Validate the inputs (make sure they are integers and in correct ranges)
    if (!year || !month) {
      message = 'Both year and month are required.';
      return res.status(400).json({ data: null, message, success: false });
    }

    const parsedYear = parseInt(year, 10);
    const parsedMonth = parseInt(month, 10);

    if (isNaN(parsedYear) || isNaN(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
      message = 'Invalid year or month.';
      return res.status(400).json({ data: null, message, success: false });
    }

    // Create a date range for the given month and year
    const startOfMonth = moment(`${parsedYear}-${String(parsedMonth).padStart(2, '0')}`, 'YYYY-MM').startOf('month').toDate();
    const endOfMonth = moment(startOfMonth).endOf('month').toDate();

    // Fetch holidays for the given month
    const holidays = await Holiday.find({
      date: { $gte: startOfMonth, $lte: endOfMonth }
    });

    res.status(200).json({ data: holidays, success: true, message: 'Holidays retrieved successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message, message: 'Error fetching holidays for the month' });
  }
};

// Get holidays for a specific year
const getHolidaysByYear = async (req, res) => {
  try {
    const { year } = req.params; // Expecting year in params (e.g., /holidays/year/2025)
    let message = "";

    // Validate the year
    if (!year) {
      message = 'Year is required.';
      return res.status(400).json({ data: null, message, success: false });
    }

    const parsedYear = parseInt(year, 10);

    if (isNaN(parsedYear)) {
      message = 'Invalid year.';
      return res.status(400).json({ data: null, message, success: false });
    }

    // Create a date range for the entire year
    const startOfYear = moment(`${parsedYear}-01-01`, 'YYYY-MM-DD').startOf('year').toDate();
    const endOfYear = moment(startOfYear).endOf('year').toDate();

    // Fetch holidays for the given year
    const holidays = await Holiday.find({
      date: { $gte: startOfYear, $lte: endOfYear }
    });

    res.status(200).json({ data: holidays, success: true, message: 'Holidays retrieved successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message, message: 'Error fetching holidays for the year' });
  }
};

export { addHoliday, deleteHolidays, getHolidaysByMonth, getHolidaysByYear };
