import JWT from 'jsonwebtoken';
import Login from '../models/login.js';
import bcrypt from 'bcryptjs';

// const login = async (req, res) => {
//   const { email, password } = req.body;

//   try {
//     // Find the user by email
//     const user = await Login.findOne({ email });

//     if (!user) {
//       return res.status(401).json({ message: 'User no found.' });
//     }

//     // Check if the password is correct
//     const isMatch = await bcrypt.compare(password, user.password);

//     if (!isMatch) {
//       return res.status(401).json({ message: 'Invalid credentials' });
//     }

//     // Create JWT payload
//     const payload = {
//       uuid: user.uuid,
//       email: user.email,
//       role: user.role,
//       createdBy: user.createdBy,
//     };

//     // Sign JWT token
//     const token = JWT.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

//     // Send the token in response
//     res.json({ token });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: 'Server error' });
//   }
// };

const login = async (req, res) => {
  let message = 'Login successfull';
  try {
    const { email, password } = req.body;
    // Aggregate to find the login by email and populate the 'userUUID' field
    const loginData = await Login.aggregate([
      { $match: { email, isDeleted: false, isActive: true } },  // Match the user by email
      {
        $lookup: {
          from: 'users',  // The collection you want to join with (assumes 'users' is the collection name)
          localField: 'userUUID',  // The field in Login model that references the User model
          foreignField: 'uuid',  // The _id field in the User model
          as: 'userDetails',  // Alias for the populated data
        }
      },
      {
        $unwind: { path: '$userDetails', preserveNullAndEmptyArrays: true }  // Flatten the result and make sure 'userDetails' is populated
      }
    ]);

    // Check if the user was found
    if (!loginData || loginData.length < 1) {
      message = 'User not found.';
      return res.status(400).json({ message, error: message });
    }

    const user = loginData[0];  // Get the first (and only) user from the result of aggregate
    if (!user.password) {
      message = 'Please set password.';
      return res.status(400).json({ message, error: 'NO_PASSWORD' });
    }

    // Check if the password is correct
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      message = 'Invalid credentials';
      return res.status(400).json({ message, error: message });
    }

    // Create JWT payload
    const payload = {
      uuid: user.userDetails.uuid,
      email: user.email,
      role: user.role,
      permissions: user.userDetails.permissions ?? [],
      orgId: user.orgId || user.userDetails.orgId,
      name: user.userDetails ? user.userDetails.name : 'Unknown',
      createdBy: user.userDetails ? user.userDetails.createdBy : null,  // Access the populated userDetails
    };

    // Sign JWT token
    const token = JWT.sign(payload, process.env.JWT_SECRET, { expiresIn: '10h' });

    // Send the token in the response
    return res.status(200).json({ data: {token, payload}, message, success: true });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};


const setPassword = async (req, res) => {
  try {
    const { email, password } = req.body;
    // Aggregate to find the login by email and populate the 'userUUID' field
    const userData = await Login.aggregate([
      { $match: { email } },  // Match the user by email
    ]);

    // Check if the user was found
    if (!userData || userData.length < 1) {
      return res.status(400).json({ message: 'User not found.', data: null, success: false });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);  // encrypt password 
    const reqData = {email, password: hashedPassword};
    await Login.findOneAndUpdate({email}, {$set: reqData});
    const data = await Login.findOne({email});
    return res.status(200).json({ message: 'Password set successfully.', data, success: true, });
    // Check if the password is correct
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

export {login, setPassword};