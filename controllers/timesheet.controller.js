import moment from 'moment';
import ExcelJS from 'exceljs';
import { newLogActivity } from './activity.controller.js';
import { ProjectMember } from '../models/project.js';
import { TimeSheet } from '../models/timesheet.js';

// Submit new timesheet
export const submitNew =  async (req, res) => {
  let message = "Timesheet submitted successfully.";
  try {
    const { uuid, orgId, name, role } = req.user;
    const {projectId, timesheetDate} = req.body;

    // Add validation for project id and timesheet date
    if (!projectId || !projectId.trim() || !timesheetDate || isNaN(Date.parse(timesheetDate))) {
      message = !projectId || !projectId.trim() ? "Invalid project id." : "Invalid timesheet date."
      return res.status(400).json({error: message, message});
    }
        
    // Check timesheet available for this project on this date
    const startDate = moment(timesheetDate).startOf('day').toDate();
    const endDate = moment(timesheetDate).endOf('day').toDate();
    let existedRec = await TimeSheet.findOne({timesheetDate: {$gte: startDate, $lte: endDate}, orgId, projectId, createdBy: uuid});
    if (existedRec !== null) {
      // existedRec.tasks = [...existedRec.tasks, ...req.body.tasks];
      // await existedRec.save();
      existedRec = await TimeSheet.findOneAndUpdate(
        { _id: existedRec._id }, // Filter by _id to update specific document
        {
          $addToSet: {
            tasks: { $each: req.body.tasks } // Add new tasks ensuring no duplicates
          },
          $set: {
            timeTaken: calculateTotalTime([...req.body.tasks, ...existedRec.tasks])
          }
        },
        { new: true } // Return updated document
      );
      // message = "Timesheet available for this project. Update them.";
      return res.status(201).json({ data: existedRec, success: true, message });
    }
    // Check that employee is assigned for this project or not
    const todayEndDate = moment().endOf('day').toDate();
    const assignedProject = await ProjectMember.findOne({employeeId: uuid, orgId, projectId, expiryDate: {$gte: todayEndDate} });
    if(assignedProject == null){
      message = "Project is not assigned you.";
      return res.status(400).json({error: message, message});
    }

    // Create new timesheet
    const utcDate = moment(timesheetDate).utc().toDate();
    const newTimesheet = new TimeSheet({ ...req.body, orgId, timeTaken: calculateTotalTime(req.body.tasks), timesheetDate: utcDate, createdBy: uuid });
    existedRec = await newTimesheet.save();
    await newLogActivity(uuid, role, name, 'Timesheet', 'Timesheet submitted', orgId, `${name} submitted new timesheet.`);
    return res.status(201).json({ message, data: existedRec, success: true });
  } catch (err) {
    return res.status(400).json({ error: err.message, message: err.message || 'Something went wrong.' });
  }
};

function calculateTotalTime(tasks) {
  return tasks.reduce((sum, task) => sum + (task.timeTaken || 0), 0);
}  

// Get Timesheet By month
export const getTimeSheetByMonth = async (req, res) => {
  let message = "Timesheet retrieved successfully.";
  try {
    const { orgId, uuid, permissions } = req.user;
    const { projectId, reqDate, employeeId } = req.body;
    let query = { orgId};

    if (projectId) query.projectId = projectId;

    if (permissions && Array.isArray(permissions) && permissions.includes("timesheet")) {
      if(employeeId && employeeId.trim() !== ""){
        query.createdBy = employeeId;
      }
    } else {
      query.createdBy = uuid;
    }

    if (isNaN(Date.parse(reqDate))) {
      return res.status(400).json({ message: "Invalid date", error: "Invalid date" });
    }
    const startDate = moment(reqDate).startOf("month").toDate();
    const endDate = moment(reqDate).endOf("month").toDate();
    query.timesheetDate = { $gte: startDate, $lte: endDate };

    const docs = await TimeSheet.find(query)
      .populate({ path: "project", select: "name" })
      .populate({ path: "user", select: "name" })
      .sort({ timesheetDate: 1 });

    const totalCount = await TimeSheet.countDocuments(query);

    return res.status(200).json({ message, data: { docs, totalCount }, success: true });
  } catch (err) {
    return res.status(500).json({
      error: err.message,
      message: err.message || "Something went wrong.",
    });
  }
};  

// Update existing timesheet (PATCH)
export const updateTimesheet = async (req, res) => {
  let message = 'Timesheet updated successfully.';
  try {
    const { uuid, orgId, role, name } = req.user;
    const { timesheetId } = req.params;

    if (!timesheetId) {
      return res.status(400).json({ message: 'Timesheet ID is required.', error: 'Invalid ID' });
    }

    // Find timesheet by ID and ownership
    const timesheet = await TimeSheet.findOne({ uuid: timesheetId, orgId, createdBy: uuid });

    if (!timesheet) {
      return res.status(404).json({ message: 'Timesheet not found.', error: 'Not found' });
    }

    // Only allow update if it's not approved
    if (timesheet.status === 'approved') {
      return res.status(403).json({ message: 'Cannot update approved timesheet.' });
    }

    // Fields allowed to be patched
    const allowedFields = ['tasks', 'timeTaken']; // , 'remark', 'status'
    for (const key of allowedFields) {
      if (req.body.hasOwnProperty(key)) {
        timesheet[key] = req.body[key];
      }
    }

    timesheet.isRejected = false; // Reset rejection if being resubmitted
    timesheet.status = 'pending';
    timesheet.timeTaken = calculateTotalTime(req.body.tasks);
      // Reset to pending if resubmitted
  //   if (req.body.status === 'resubmitted') {
  //   }

    await timesheet.save();
    await newLogActivity(uuid, role, name, 'Timesheet', 'Timesheet updated', orgId, `${name} updated their timesheet.`);
    return res.status(200).json({ message, data: timesheet, success: true });
  } catch (err) {
    return res.status(400).json({ error: err.message, message: err.message || 'Something went wrong.' });
  }
};

// Update Status via admin
export const adminUpdateRemarkAndStatus = async (req, res) => {
  try {
    const { role, orgId, name, uuid } = req.user;
    const { timesheetId } = req.params;
    const { remark, status } = req.body;

    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value.', message: 'Invalid status value.' });
    }

    if ((!remark || typeof remark !== 'string') && status === 'rejected') {
      return res.status(400).json({ message: 'Remark is required.' });
    }

    const timesheet = await TimeSheet.findOne({ uuid: timesheetId, orgId });

    if (!timesheet) {
      return res.status(404).json({error: 'Timesheet not found.', message: 'Timesheet not found.' });
    }
    // if (timesheet.status !== 'pending') {
    //   return res.status(400).json({error: `Timesheet already ${timesheet.status}`, message: `Timesheet already ${timesheet.status}` });
    // }

    timesheet.remark = remark;
    timesheet.status = status;
    timesheet.isRejected = status === 'rejected';
    await timesheet.save();
    await newLogActivity(uuid, role, name, 'Timesheet', `Timesheet ${status}`, orgId, `${name} ${status} a timesheet with remark.`);
    return res.status(200).json({
      message: `Timesheet ${status} successfully.`,
      success: true,
      data: timesheet,
    });
  } catch (err) {
    return res.status(500).json({
      error: err.message,
      message: 'Failed to update remark or status.',
    });
  }
};

// Find single Timesheet
export const findSingleTimesheet = async (req, res) => {
  try {
    const { orgId, uuid, permissions } = req.user;
    let query = {uuid: req.params.timesheetId, orgId};
    if(!permissions || !Array.isArray(permissions) || !permissions.includes('timesheet')){
      query.createdBy = uuid;
    }
    let doc = await TimeSheet.findOne(query);
    const message = doc == null ? 'Timesheet not found.' : 'Timesheet found';
    if(doc == null){
      return res.status(404).json({error: message, message});
    }
    return res.status(200).json({data: doc, message, success: true});
  } catch (error) {
    return res.status(500).json({ error: err.message, message: err.message || 'Something went wrong.' });
  }
}

// Delete Timesheet
export const deleteTimesheet = async (req, res) => {
  try {
    const { orgId, uuid, role, name } = req.user;
    let doc = await TimeSheet.findOne({uuid: req.params.timesheetId, orgId, createdBy: uuid });
    const message = doc == null ? 'Timesheet not found.' : 'Timesheet Deleted';
    if(doc == null){
      return res.status(404).json({error: message, message});
    }
    const updatedDoc = await doc.deleteOne();
    await newLogActivity(uuid, role, name, 'Timesheet', 'Timesheet deleted', orgId, `${name} deleted timesheet.`);
    return res.status(200).json({data: updatedDoc, message, success: true});
  } catch (error) {
    return res.status(500).json({ error: err.message, message: err.message || 'Something went wrong.' });
  }
}

// Download Excel sheet
export const downloadExcel = async (req, res) => {
  try {
    const {projectId, timesheetDate, reportType} = req.body;
    const {orgId, uuid, permissions} = req.user;
    if (!timesheetDate || isNaN(Date.parse(timesheetDate))) {
      const message = !timesheetDate ? "Timsheet date is required." : "Invalid timesheet date."
      return res.status(400).json({error: message, message});
    }
    if(!reportType || !['project', "user"].includes(reportType.toString().toLowerCase())){
      return res.status(400).json({error: "Type is required", message: "Type is required"});
    }
    if(reportType.toLowerCase() === 'project' && !projectId){
      return res.status(400).json({error: "Project id is required", message: "Project id is required"});
    }
    const startDate = moment(timesheetDate).startOf('month').toDate();
    const endDate = moment(timesheetDate).endOf('month').toDate();
    let timesheetQuery = {orgId, timesheetDate: {$gte: startDate, $lte: endDate}};
    if(reportType.toLowerCase() === 'project' && projectId && projectId.toString().trim() !== ''){
      timesheetQuery.projectId = projectId;
    } else if(reportType.toLowerCase() === 'user'){
      timesheetQuery.createdBy = uuid;
    }
    const timeSheets = await TimeSheet.find(timesheetQuery)
      .populate({ path: "user", select: "name" })
      .populate({ path: "project", select: "name" })
      .lean();
    if(timeSheets.length < 1){
      return res.status(404).json({error: "Timesheet not found", message: "Timesheet not found."});
    }
    const workbook = new ExcelJS.Workbook();
    const grouped = {};

    const isProjectWise = reportType.toLowerCase() === 'project';

    // Group data
    for (const sheet of timeSheets) {
      const groupKey = isProjectWise ? sheet.projectId : sheet.createdBy;
      if (!grouped[groupKey]) grouped[groupKey] = [];
      grouped[groupKey].push(sheet);
    }

    // Create sheet
    for(const key in grouped) {
      const entries = grouped[key];
      const firstEntry = entries[0];
      const sheetName = isProjectWise ? firstEntry.project?.name || 'Project' : firstEntry.user?.name || 'User';
      const worksheet = workbook.addWorksheet(sheetName);

      worksheet.columns = [
        { header: "Date", key: 'date', width: 15 },
        ...(isProjectWise
          ? [{ header: "Employee", key: 'user', width: 20 }]
          : [{ header: "Project", key: 'project', width: 20 }]
        ),
        { header: "Task Title", key: 'title', width: 30 },
        { header: "Description", key: 'description', width: 40 },
        { header: 'Time Taken (min)', key: 'timeTaken', width: 20 },
      ];

      worksheet.getRow(1).font = {bold: true};
      let totalMinutes = 0;

      for(const entry of entries){
        const userName = entry.user?.name || 'N/A';
        const projectName = entry.project?.name || 'N/A';

        entry.tasks.forEach((task) => {
          worksheet.addRow({
            date: moment(entry.timesheetDate).format('YYYY-MM-DD'),
            ...(isProjectWise ? {user: userName} :
            {project: projectName}),
            title: task.title,
            description: task.description,
            timeTaken: task.timeTaken,
          });
          totalMinutes += task.timeTaken;
        });

        // worksheet.addRow({});
        // worksheet.addRow({
        //   date: '',
        //   title: isProjectWise ? `Employee: ${userName}` : `Project: ${projectName}`,
        //   description: 'Subtotal',
        //   timeTaken: formatDuration(totalMinutes),
        // }).font = { bold: true };

      }
      worksheet.addRow({});
      worksheet.addRow({
        date: '',
        user: '',
        project: '',
        title: '',
        description: 'Total Time',
        timeTaken: formatDuration(totalMinutes),
      }).font = { bold: true };
    }

    // Send file
    res.setHeader('Content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=timesheet_${reportType}_${Date.now()}.xlsx`);

    await workbook.xlsx.write(res);
    res.status(200).end();
  } catch (error) {
    return res.status(500).json({ error: err.message, message: err.message || 'Something went wrong.' });
  }
}
export const formatDuration = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours} hour${hours !== 1 ? 's' : ''}, ${mins} minute${mins !== 1 ? 's' : ''}`;
};
