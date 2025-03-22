import moment from "moment";
import { ActivityLog } from "../models/activity-logs.js";

export const newLogActivity = async (userId, role, userName, module, action, orgId, details) => {
  try {
    const newActivity = new ActivityLog({action, details,module, orgId, role, createdBy: userId, userName});
    await newActivity.save();
  } catch (error) {
    console.error("Error logging activity:", error);
  }
};

export const deleteOldActivities = async () => {
    try {
      // Delete records older than 3 months (Move this to a scheduled background task)
      const maxDate = moment().subtract(3, 'months').endOf('month').toDate();
      await ActivityLog.deleteMany({createdAt: {$lt: maxDate}});
      console.log("✅ Old activity logs deleted successfully.");
    } catch (error) {
      console.error("❌ Error deleting old logs:", error);
    }
}

export const getActivityLogs = async (req, res) => {
    let message = "Activity logs fetched successfully";
    try {
      const { orgId } = req.user;
      const { module, role, endDate, skip, limit } = req.body;
      let filter = {orgId};
      const today = moment().startOf("day").toDate();
  
      if (module) filter.module = module;
    //   if (role) filter.role = role;
      if (endDate) {
        // Validation for date
        if (isNaN(Date.parse(endDate))) {
            message = 'Invalid date format.';
            return res.status(400).json({ error: message, message });
        }
        filter.createdAt = {$gte: today, $lte: new Date(endDate) };
      }
      
      // Fetch activity logs with pagination
      const docs = await ActivityLog.find(filter).sort({ createdAt: -1 }).skip(parseInt(skip, 10) || 0).limit(parseInt(limit, 10) || 10);
      const totalCount = await ActivityLog.countDocuments(filter);
      return res.status(200).json({ data: {docs, totalCount}, success: true, message });
    } catch (error) {
      message = "Error fetching activity logs"
      return res.status(500).json({ error: error.message ?? error, message });
    }
};
