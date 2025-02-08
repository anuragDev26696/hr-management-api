import Employee from "../models/employee.js";
import Login from "../models/login.js";
import { v4 as uuidv4 } from "uuid"; // Use uuidv4 for generating UUIDs

// Create new user
export const newUser = async (req, res) => {
  try {
    const { email, joiningDate } = req.body;
    // Find the user by email
    const user = await Login.findOne({ email, isDeleted: false });
    let message = "";
    if (user) {
      message = "Employee already exist.";
      return res.status(400).json({success: false, error: message, message});
    }
    
    if(!joiningDate){
      return res.status(400).json({success: false, error: 'Joining date is required.'})
    } 
    const isValidDate = !isNaN(Date.parse(isValidDate));
    if (!isValidDate) {
      message = 'Invalid date format.';
      return res.status(400).json({ data: null, message, success: false });
    }
    else {
      const newReq = new Employee({
        ...req.body,
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
      const data = await Employee.findById(newUser._id).populate('departmentDetail').exec();
      return res.status(200).json({ data, message: "User created successfully.", success: true });
    }
  } catch (error) {
    return res.status(400).json({ error, message: error.message || "Something went wrong." });
  }
};

// Update user
export const updateUser = async (req, res) => {
  const { userId } = req.params; // Extract employee uuid (id) from URL
  const {workingDays} = req.body;
  let message = "";
  try {
    // Find the employee to update
    let existingItem = await Employee.findOne({ uuid: userId }).populate('departmentDetail').exec();
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
    const data = await Employee.findOne({uuid: userId}).populate('departmentDetail').exec();;
    return res.status(200).json({data: existingItem, message: "User updated successfully.", success: true});
  } catch (error) {
    return res.status(400).json({ error, message: error.message || "Something went wrong." });
  }
};

// Delete user
export const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    await Employee.findOneAndDelete({ uuid: userId }).exec();
    return res.status(200).json({ message: "User deleted successfully.", success: true, data: {} });
  } catch (error) {
    return res.status(400).json({ error, message: error.message || "Something went wrong." });
  }
};

// Get all filtered users with pagination
export const getFilteredUsers = async (req, res) => {
  try {
    const user = req.user;
    const { skip = 0, limit = 20, role = "", search_string = "", isActive = true, } = req.body;
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

    // MongoDB query with pagination and population of departmentDetail
    const docs = await Employee.find(query)
    .skip(parseInt(skip) * parseInt(limit)) // Skip logic for pagination
    .limit(parseInt(limit)) // Limit the number of results
    .populate('departmentDetail') // Populate the departmentDetail field
    .exec();

    // Format the date for each employee
    const formattedDocs = docs.map((item) => {
      const formattedEmployee = item.toObject();
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
    const user = req.user;
    const { skip = 0, limit = 20 } = req.query;
    const acceptLanguage = req.headers?.['accept-language'] || 'en-US';
    const locale = acceptLanguage.split(',')[0];

    // MongoDB query with pagination and population of departmentDetail
    const docs = await Employee.find()
      .skip(parseInt(skip) * parseInt(limit)) // Skip logic for pagination
      .limit(parseInt(limit)) // Limit the number of results
      .sort({createdAt: -1}) // Sort data
      .populate('departmentDetail') // Populate the departmentDetail field
      .exec();

    // Format the date for each employee
    const formattedDocs = docs.map((item) => {
      const formattedEmployee = item.toObject();
      // Format the joiningDate based on the provided locale
      if (formattedEmployee.joiningDate) {
        formattedEmployee.formattedJoinDate = new Date(formattedEmployee.joiningDate).toLocaleDateString(locale, {year: "numeric", month: "long", day: "numeric"});
      }
      return formattedEmployee;
    });

    // Get the total count of filtered documents
    const total = await Employee.countDocuments();
    return res.status(200).json({message: "Users retrieved successfully.", success: true, data: { docs: formattedDocs, total }});
  } catch (error) {
    return res.status(500).json({message: "Server error.", success: false, data: null, error: error.message});
  }
};

// Get single user
export const getUser = async (req, res) => {
  try {
    const { userId } = req.params; // Assuming the user ID is passed as a parameter
    // Fetch the user with the provided ID and populate departmentDetail
    const employee = await Employee.findOne({ uuid: userId })
      .populate('departmentDetail') // Populate the departmentDetail
      .exec();

    // If employee not found
    if (!employee) {
      return res.status(404).json({message: "User not found.", success: false, data: null});
    }
    const acceptLanguage = req.headers?.['accept-language'] || 'en-US';
    const locale = acceptLanguage.split(',')[0];

    // Format the joiningDate
    const formattedEmployee = employee.toObject(); // Convert to plain JavaScript object
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
    const { uuid, createdBy } = req.user;
    let message = "Employee deleted.";
    const result = await Employee.findOneAndDelete({uuid: userId, createdBy: {$in: [uuid, createdBy]}});
    return res.status(200).json({success: true, message, data: result});
  } catch (error) {
    return res.status(500).json({message: error.message, error: error.message});
  }
}

export const deleteAll = async (req, res) => {
  try {
    const { employeeIds = [] } = req.body;
    let message = "Employee deleted.";
    if(Array.isArray(employeeIds) || employeeIds.length < 1){
      message = "Employeed Id list is required";
      return res.status(400).json({success: false, message, error: message});
    }
    const result = await Employee.deleteMany({uuid: {$in: employeeIds}});
    return res.status(200).json({success: true, message, data: result});
  } catch (error) {
    return res.status(500).json({success: false, message: error.message, error: error.message});
  }
}

// Function to update working days for an employee
export const updateWorkingDays = async (req, res) => {
  try {
    const { employeeId } = req.body;
    const { uuid, role, createdBy } = req.user;
    const user = await Employee.findOne({employeeId});
    if (!user) {
      return res.status(500).json({message: "User not found.", success: false, error: "User not found."});
    }
  
    const currentDate = moment();
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
