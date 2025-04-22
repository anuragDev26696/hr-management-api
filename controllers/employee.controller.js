import Employee from "../models/employee.js";
import { LeaveBalance } from "../models/leaveBalance.js";
import Login from "../models/login.js";
// import { v4 as uuidv4 } from "uuid"; // Use uuidv4 for generating UUIDs
import moment from "moment";
import { newLogActivity } from "./activity.controller.js";

// Create new user
export const newUser = async (req, res) => {
  try {
    const { email, joiningDate } = req.body;
    const { orgId, uuid, name, role } = req.user;
    // Find the user by email
    const user = await Login.findOne({ email, isDeleted: false });
    const employee = await Employee.findOne({ email, orgId, isDeleted: false });
    let message = "";
    if (user || employee) {
      message = "Employee already exist.";
      return res.status(400).json({success: false, error: message, message});
    }
    
    if(!joiningDate){
      return res.status(400).json({success: false, error: 'Joining date is required.'})
    } 
    const isValidDate = !isNaN(Date.parse(joiningDate));
    if (!isValidDate) {
      message = 'Invalid date format.';
      return res.status(400).json({ data: null, message, success: false });
    }
    else {
      const newReq = new Employee({
        ...req.body,
        orgId,
        createdBy: uuid,
        workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], // 6 days
        workingDaysHistory: [
          {
            startDate: new Date(joiningDate),
            endDate: null,
            workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
          },
        ],
      });
      const newUser = await newReq.save();
      const employeeDoc = await Employee.findById(newUser._id).populate({ path: 'departmentDetail' }).lean();
      // Calculate the number of days remaining in the current year
      const currentYear = moment().year();
      const endOfYear = moment(`${currentYear}-12-31`);
      const daysInYear = endOfYear.diff(moment(`${currentYear}-01-01`), 'days') + 1; // +1 to include the current day
      const remainingDays = endOfYear.diff(moment(joiningDate), 'days');

      // Calculate remaining LOP leaves based on the ratio of remaining days to total days in the year
      const remainingLopLeavesRatio = (remainingDays / daysInYear) * 365;
      const newLeaveBalance = new LeaveBalance({
        employeeId: employeeDoc.uuid,
        orgId: employeeDoc.orgId,
        lastCreditDate: new Date(joiningDate),
      });
      await newLeaveBalance.save();
      await newLogActivity(uuid, role, name, "Employee", "Add Employee", orgId, `${name} added new employee.`);
      return res.status(200).json({ data: employeeDoc, message: "User created successfully.", success: true });
    }
  } catch (error) {
    return res.status(400).json({ error, message: error.message || "Something went wrong." });
  }
};

// Update user
export const updateUser = async (req, res) => {
  let message = "";
  try {
    const { userId } = req.params; // Extract employee uuid (id) from URL
    const {workingDays} = req.body;
    const {uuid, orgId, name, role} = req.user;
    // Find the employee to update
    let existingItem = await Employee.findOne({ uuid: userId });
    if (!existingItem) {
      message = "User not found.";
      return res.status(404).json({ error: message, message: message, success: false });
    }
    // Perform partial update
    // await existingItem.save();
    await Employee.findOneAndUpdate(
      { uuid: userId },
      { $set: req.body },
      { new: true, runValidators: true } // `new: true` returns the updated document
    );
    await Login.findOneAndUpdate({userUUID: userId}, {$set: {isActive: existingItem.isActive}});
    const logMessage = uuid == userId ? `${name} updated own profile.` : `${name} updated ${existingItem.name}\'s profile.`;
    await newLogActivity(uuid, role, name, "Employee", "Update "+(uuid == userId ? "Profile" : "Employee profile"), orgId, logMessage);
    existingItem = await Employee.findOne({ uuid: userId }).populate({ path: 'departmentDetail' }).lean();
    return res.status(200).json({data: existingItem, message: "User updated successfully.", success: true});
  } catch (error) {
    return res.status(400).json({ error, message: error.message || "Something went wrong." });
  }
};

// Delete user
export const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { orgId, name, uuid, role } = req.user;
    const empName = await Employee.findOne({ uuid: userId, orgId }, "name");
    await Employee.findOneAndDelete({ uuid: userId, orgId }).exec();
    await Login.findOneAndDelete({ userUUID: userId, orgId }).exec();
    await newLogActivity(uuid, role, name, "Employee", "Drop Employee", orgId, `${name} droped ${empName}`);
    return res.status(200).json({ message: "User deleted successfully.", success: true, data: {} });
  } catch (error) {
    return res.status(400).json({ error, message: error.message || "Something went wrong." });
  }
};

// Get all filtered users with pagination
export const getFilteredUsers = async (req, res) => {
  try {
    const loginId = req.user.uuid;
    const loginRole = req.user.role;
    const { skip = 0, limit = 20, role = "", search_string = "", isActive = null, } = req.body;
    // Initialize the query filter
    let query = {};
    // Extract the primary language from the 'accept-language' header
    const acceptLanguage = req.headers?.['accept-language'] || 'en-US'; // Default to 'en-US' if not provided
    const locale = acceptLanguage.split(',')[0]; // Take the first language in the list

    // If a specific role is provided, filter by role
    if (role.trim() !== "") {
      query.role = role;
    }

    // If a search string is provided, search in the name field (case-insensitive)
    query.name = { $regex: search_string, $options: "i" }; // Case-insensitive search in the name field
    if (isActive != null && loginRole === 'admin') {
      query.isActive = isActive;
    }else {
      query.isActive = true;
    }

    // MongoDB query with pagination and population of departmentDetail
    const docs = await Employee.find(query)
    .skip(parseInt(skip) * parseInt(limit)) // Skip logic for pagination
    .limit(parseInt(limit)) // Limit the number of results
    .populate({ path: 'departmentDetail' }) // Populate the departmentDetail field
    .lean();

    // Format the date for each employee
    const formattedDocs = docs.map((item) => {
      const formattedEmployee = item;
      // Format the joiningDate based on the provided locale
      if (formattedEmployee.joiningDate) {
        formattedEmployee.formattedJoinDate = new Date(formattedEmployee.joiningDate).toLocaleDateString(locale, {year: "numeric", month: "long", day: "numeric"});
      }
      return formattedEmployee;
    });

    // Get the total count of filtered documents
    const total = await Employee.countDocuments(query);

    return res.status(200).json({message: "Users retrieved successfully.", success: true, data: { docs: formattedDocs, total }});
  } catch (error) {
    return res.status(400).json({ error, message: error.message || "Something went wrong." });
  }
};

export const getAll = async (req, res) => {
  try {
    const {orgId, role} = req.user;
    let { skip = 0, limit = 20, isActive=null, search_string="" } = req.query;
    const acceptLanguage = req.headers?.['accept-language'] || 'en-US';
    const locale = acceptLanguage.split(',')[0];
    let query = {orgId, 
      $or: [
        {name: { $regex: search_string, $options: "i" }},
        {email: { $regex: search_string, $options: "i" }},
        {designation: { $regex: search_string, $options: "i" }},
        {position: { $regex: search_string, $options: "i" }}
      ],
    }
    // Correctly handle the isActive parameter
    if (role === 'admin') {
      if (isActive === 'true') { // Check for the string "true"
        isActive = true;
      } else if (isActive === 'false') { // Check for the string "false"
        isActive = false;
      } else if (isActive === 'null' || isActive === undefined) { // Check for "null" or undefined
        isActive = null;  // Explicitly set to null
      }
      if(isActive != null)
        query = {...query, orgId, isActive: isActive }; // Use the correctly typed isActive
    } else {
      query = {...query, orgId, isActive: true }; // Enforce isActive: true for non-admins
    }

    // MongoDB query with pagination and population of departmentDetail
    const docs = await Employee.find(query)
      .skip(parseInt(skip) * parseInt(limit)) // Skip logic for pagination
      .limit(parseInt(limit)) // Limit the number of results
      .sort({createdAt: -1}) // Sort data
      .populate({ path: 'departmentDetail' }) // Populate the departmentDetail field
      .lean();

    // Format the date for each employee
    const formattedDocs = docs.map((item) => {
      const formattedEmployee = item;
      // Format the joiningDate based on the provided locale
      if (formattedEmployee.joiningDate) {
        formattedEmployee.formattedJoinDate = new Date(formattedEmployee.joiningDate).toLocaleDateString(locale, {year: "numeric", month: "long", day: "numeric"});
      }
      return formattedEmployee;
    });

    // Get the total count of filtered documents
    const total = await Employee.countDocuments(query);
    return res.status(200).json({message: "Users retrieved successfully.", success: true, data: { docs: formattedDocs, total }});
  } catch (error) {
    return res.status(500).json({message: "Server error.", success: false, data: null, error: error.message});
  }
};

// Get single user
export const getUser = async (req, res) => {
  try {
    const { userId } = req.params; // Assuming the user ID is passed as a parameter
    const { orgId } = req.user; // Assuming the user ID is passed as a parameter
    // Fetch the user with the provided ID and populate departmentDetail
    const employee = await Employee.findOne({ uuid: userId, orgId })
      .populate({ path: 'departmentDetail' }) // Populate the departmentDetail
      .lean();

    // If employee not found
    if (!employee) {
      return res.status(404).json({message: "User not found.", success: false, data: null});
    }
    const acceptLanguage = req.headers?.['accept-language'] || 'en-US';
    const locale = acceptLanguage.split(',')[0];

    // Format the joiningDate
    const formattedEmployee = employee; // Convert to plain JavaScript object
    // Format the joiningDate based on the locale
    if (formattedEmployee.joiningDate) {
      formattedEmployee.formattedJoinDate = new Date(formattedEmployee.joiningDate).toLocaleDateString(locale, {year: "numeric", month: "long", day: "numeric",});
    }
    return res.status(200).json({message: "User retrieved successfully.", success: true, data: formattedEmployee});
  } catch (error) {
    return res.status(500).json({message: "Server error.", success: false, data: null, error: error.message});
  }
};

export const deleteSingleUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { uuid, createdBy, orgId } = req.user;
    const result = await Employee.findOneAndDelete({uuid: userId, orgId, createdBy: {$in: [uuid, createdBy]}});
    if (result) {
      await Login.findOneAndDelete({userUUID: userId, orgId});
    }
    let message = result ? "Employee deleted." : "Employee not found.";
    return res.status(result?200:404).json({success: result != null, message, data: result});
  } catch (error) {
    return res.status(500).json({message: error.message, error: error.message});
  }
}

export const deleteAll = async (req, res) => {
  try {
    const { employeeIds = [] } = req.body;
    const { orgId } = req.user;
    let message = "Employee deleted.";
    if(Array.isArray(employeeIds) || employeeIds.length < 1){
      message = "Employeed Id list is required";
      return res.status(400).json({success: false, message, error: message});
    }
    const result = await Employee.deleteMany({uuid: {$in: employeeIds}, orgId});
    return res.status(200).json({success: true, message, data: result});
  } catch (error) {
    return res.status(500).json({success: false, message: error.message, error: error.message});
  }
}

// Function to update working days for an employee
export const updateWorkingDays = async (req, res) => {
  try {
    const { employeeId } = req.body;
    const { uuid, role, createdBy, orgId } = req.user;
    const user = await Employee.findOne({employeeId, orgId, isActive: true});
    if (!user) {
      return res.status(500).json({message: "User not found.", error: "User not found."});
    }
    const oneYearAgo = moment().subtract(1, 'year');
    // Check if the user should have a 5-day work week now
    const currentPolicy = user.workingDaysHistory[user.workingDaysHistory.length - 1];
    if (!currentPolicy || moment(currentPolicy.startDate).isBefore(oneYearAgo)) {
      // If the employee has been with the company for 1 year or more, change to 5 days
      const updatedWorkingDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  
      // Add the current working days to history
      user.workingDaysHistory.push({
        startDate: currentPolicy ? currentPolicy.endDate : moment('2025-02-02'), // start date of new policy (based on previous policy end date)
        endDate: null, // no end date for current policy
        workingDays: user.workingDays, // previous working days (6 days)
      });
  
      // Save the changes to the user
      await user.save();
      return res.status(200).json({message: "New working days assigned.", success: true, data: user});
    }
  } catch (error) { 
    return res.status(500).json({message: error.message || "Server error.", success: false, error: error.message});
  }
};

export const getWorkingDaysForDate = (workingDaysHistory, date) => {
  // Get the correct working days based on the provided date
  for (let i = workingDaysHistory.length - 1; i >= 0; i--) {
    const policy = workingDaysHistory[i];
    if (moment(date).isBetween(policy.startDate, policy.endDate, null, '[)')) {
      return policy.workingDays;
    }
  }

  // If no policy is found, fallback to the current working days
  return user.workingDays;
};
