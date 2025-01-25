import jwt from 'jsonwebtoken';

// Middleware to verify JWT
export const authGuard = (req, res, next) => {
  const token = req.header('authorization');  // Token sent in the header as authorization

  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Add user data to the request object
    req.user = decoded;
    next(); // Call the next middleware or route handler
  } catch (err) {
    console.error(err);
    res.status(401).json({ message: 'Token is not valid' });
  }
};


// Middleware to verify admin
export const adminGuard = (req, res, next) => {
  const token = req.header('authorization');  // Token sent in the header as authorization

  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log(decoded.payload, " :payload in adminGuard");
    if (!decoded.payload.role || decoded.payload.role !== 'admin' || !decoded.payload.isAdmin) {
      res.status(401).json({ message: 'Access denied.' });
      return;
    }
    req.user = decoded;
    next(); // Call the next middleware or route handler
  } catch (err) {
    console.error(err);
    res.status(401).json({ message: 'Access denied.' });
  }
};

// Middleware to verify HR
export const HRGuard = (req, res, next) => {
  const token = req.header('authorization');  // Token sent in the header as authorization

  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.payload.role || decoded.payload.role !== 'hr' || !decoded.payload.isHR) {
      res.status(401).json({ message: 'Access denied.' });
      return;
    }
    req.user = decoded;
    next(); // Call the next middleware or route handler
  } catch (err) {
    res.status(401).json({ message: 'Access denied.' });
  }
};