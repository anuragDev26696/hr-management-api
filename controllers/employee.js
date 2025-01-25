import Employee from "../models/employee.js";
import Login from '../models/login.js';
import { v4 as uuidv4 } from 'uuid'; // Use uuidv4 for generating UUIDs

// Create new user
export const newUser = async (req, res) => {
    console.log(req.body);
  try {
    const { email } = req.body;
    // Find the user by email
    const user = await Login.findOne({ email, isDeleted: false });
    if (user) {
        throw new Error("Employee already exist.");
    } else {
        const newReq = new Employee(req.body);
        const newUser = await newReq.save();
        const data = await Employee.findById(newUser._id);
        res.status(200).json({data, message: "User created successfully.", success: true});
    }
  } catch (error) {
    throw error;
  }
}

// Update user
export const updateUser = async (req, res) => {
    try {
        return res.status(200).json({message: 'User deleted successfully.', success: true, data: {}});
    } catch (error) {
        throw error;
    }
}

// Delete user
export const deleteUser = async (req, res) => {
    try {
        const {userId} = req.params;
        await Employee.findOneAndDelete({uuid: userId}).exec();
        return res.status(200).json({message: 'User deleted successfully.', success: true, data: {}});
    } catch (error) {
        throw error;
    }
}

// Get all filtered users with pagination
export const getFilteredUsers = async (req, res) => {
    try {
        return res.status(200).json({message: 'User deleted successfully.', success: true, data: {}});
        
    } catch (error) {
        throw error;
    }
}

// Get all users with pagination
export const getAll = async (req, res) => {
    try {
        
        return res.status(200).json({message: 'User deleted successfully.', success: true, data: {}});
    } catch (error) {
        throw error;
    }
}