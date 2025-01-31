import Employee from "../models/employee.js";
import Login from "../models/login.js";
import { v4 as uuidv4 } from "uuid"; // Use uuidv4 for generating UUIDs

// Create new user
export const newUser = async (req, res) => {
  try {
    const { email } = req.body;
    // Find the user by email
    const user = await Login.findOne({ email, isDeleted: false });
    if (user) {
      throw new Error("Employee already exist.");
    } else {
      const newReq = new Employee(req.body);
      const newUser = await newReq.save();
      const data = await Employee.findById(newUser._id).populate('departmentDetail').exec();
      res.status(200).json({ data, message: "User created successfully.", success: true });
    }
  } catch (error) {
    res.status(400).json({ error, message: error.message || "Something went wrong." });
  }
};

// Update user
export const updateUser = async (req, res) => {
    try {
      const { userId } = req.params; // Extract employee uuid (id) from URL
      const updateData = req.body; // Extract the data to update from request body
      // Validate the update data
      if (Object.keys(updateData).length === 0) {
        throw new Error("No update data provided.");
      }
      // Find the employee to update
      let existingItem = await Employee.findOne({ uuid: userId });
      if (!existingItem) {
        throw new Error("User not found.");
      }
      // Perform partial update
      const result = await Employee.findOneAndUpdate(
        { uuid: userId },
        { $set: updateData },
        { new: true, runValidators: true } // `new: true` returns the updated document
      ).populate('departmentDetail').exec();
      const data = await Employee.findById(result._id);
      res.status(200).json({data, message: "User updated successfully.", success: true});
    } catch (error) {
      res.status(400).json({ error, message: error.message || "Something went wrong." });
    }
};

// Delete user
export const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    await Employee.findOneAndDelete({ uuid: userId }).exec();
    return res.status(200).json({ message: "User deleted successfully.", success: true, data: {} });
  } catch (error) {
    res.status(400).json({ error, message: error.message || "Something went wrong." });
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
    res.status(400).json({ error, message: error.message || "Something went wrong." });
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
