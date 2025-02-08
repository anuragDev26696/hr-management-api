import Department from "../models/department.js";

export const createDepartment = async (req, res) => {
  try {
    let newDepartment = new Department(req.body);
    newDepartment.createdBy = req.user.userId; // Assuming userId is in req.user
    // Step 1: Save the new department
    const data = await newDepartment.save();
    // Step 2: Respond with success message and department data
    return res.status(201).json({data, message: "Department created successfully.", success: true});
  } catch (error) {
    return res.status(500).json({message: "An error occurred while create department.", success: false, error: error.message});
  }
};

// Get single department
export const getSingleDepartment = async (req, res) => {
  try {
    const { id } = req.params; // Extract the department uuid (id)
    // Step 1: Find the department by uuid
    const department = await Department.findOne({ uuid: id });
    if (!department) {
      return res.status(404).json({message: "Department not found.", success: false, data: null});
    }
    // Step 2: Respond with the department and employee data
    res.status(200).json({ data: department, message: "Department fetched successfully.", success: true});
  } catch (error) {
    res.status(500).json({message: "An error occurred while fetching the department.", success: false, error: error.message});
  }
};

// Update department
export const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params; // Extract department uuid (id) from URL
    const updateData = req.body; // Extract the data to update from request body
    let message = "Department updated successfully.";
    // Validate the update data
    if (Object.keys(updateData).length === 0) {
      throw new Error("No update data provided.");
    }
    // Find the department to update
    let existingItem = await Department.findOne({ uuid: id });
    if (!existingItem) {
      message = "Department not found.";
      return res.status(500).json({message, error: message});
    }
    // Check for duplicate sub-department name in the updated data
    if (updateData.subDepartments) {
      const subDepartments = updateData.subDepartments;
      for (let subDepartment of subDepartments) {
        const existingSubDept = await Department.findOne({
          'subDepartments.name': subDepartment.name,
          uuid: { $ne: id }, // Ensure it's not the same department
        });

        if (existingSubDept) {
          message = `Sub-department name "${subDepartment.name}" already exists in another department.`;
          return res.status(500).json({message, error: message});
        }
      }
    }

    // Perform partial update
    const result = await Department.findOneAndUpdate(
      { uuid: id },
      { $set: updateData },
      { new: true, runValidators: true } // `new: true` returns the updated document
    );
    const data = await Department.findById(result._id);
    return res.status(200).json({data, message, success: true});
  } catch (error) {
    return res.status(500).json({message: error.message || error || "Server error.", success: false, error: error.message || error});
  }
};

// Delete department
export const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await Department.findOneAndDelete({ uuid: id });
    return res.status(200).json({ message: "Department deleted successfully.", success: true, data });
  } catch (error) {
    throw error;
  }
};

// Get all filtered users with pagination
export const getFilteredUsers = async (req, res) => {
  try {
    return res
      .status(200)
      .json({ message: "User deleted successfully.", success: true, data: {} });
  } catch (error) {
    throw error;
  }
};

// Get all departments with filters
export const getAll = async (req, res) => {
  try {
    const {skip = 0, limit = 20, search_string = "", isActive = true} = req.body;
    // Initialize the query filter
    let query = {};
    // If isActive is not null and it's boolean
    query.isActive = isActive;

    // If a search string is provided, search in the name field (case-insensitive)
    if (search_string) {
        query.$or = [
            { name: { $regex: search_string, $options: "i" } },  // Search in department name
            { description: { $regex: search_string, $options: "i" } },  // Search in department description
            {
              subDepartments: {
                $elemMatch: {
                  name: { $regex: search_string, $options: "i" }, // Search in subDepartment's name
                },
              },
            },  // Search in subDepartment names
        ];
    }

    // MongoDB query
    const docs = await Department.find(query).skip(parseInt(skip) * parseInt(limit)).limit(parseInt(limit)).sort({createdAt: -1});
    const total = await Department.countDocuments(query); // Get the total count of filtered documents

    return res.status(200).json({message: "Department retrived successfully.", success: true, data: { docs, total }});
  } catch (error) {
    return res.status(500).json({ message: "Server error.", success: false, data: null, error });
  }
};
