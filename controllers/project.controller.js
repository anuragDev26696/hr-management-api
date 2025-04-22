import moment from 'moment';
import Employee from '../models/employee.js';
import { newLogActivity } from './activity.controller.js';
import { ProjectMember, Project } from '../models/project.js';

// Create a Project
export const createProject =  async (req, res) => {
    let message = "Project created successfully.";
    try {
        const { uuid, orgId, name, role } = req.user;
        const projectName = req.body.name?.trim() || "";
        const employee = await Employee.findOne({uuid, orgId, isActive: true});
        if (!employee) {
            return res.status(404).json({ message: "Employee not found." });
        }

        // Fetch leave balance after creation (if it didn't exist before)
        const projectDoc = await Project.findOne({name: projectName, orgId});
        if(projectDoc){
            message = "Project already exist.";
            return res.status(400).json({message, error: message});
        }

        const newRecord = new Project({...req.body, createdBy: uuid, orgId});
        const savedProject = await newRecord.save();
        await newLogActivity(uuid, role, name, 'Project', 'Create project', orgId, `${name} created new project.`);
        return res.status(201).json({ message, data: savedProject, success: true });
    } catch (err) {
        return res.status(400).json({ error: err.message, message: err.message || 'Something went wrong.' });
    }
};

// Get Project By Id
export const getProjectById =  async (req, res) => {
    let message = "Project retrived successfully.";
    try {
        const { orgId } = req.user;
        const projectId = req.params.projectId;
        const projectDoc = await Project.findOne({uuid: projectId, orgId}).populate('members');
        // Fetch leave balance after creation (if it didn't exist before)
        if (!projectDoc) {
            return res.status(404).json({ message: "Project not found." });
        }
        return res.status(200).json({ message, data: projectDoc, success: true });
    } catch (err) {
        return res.status(400).json({ error: err.message, message: err.message || 'Something went wrong.' });
    }
};

// Fetch all projects
export const getProjects = async (req, res) => {
    try {
        const { uuid, role, orgId } = req.user;
        let { skip = 0, limit = 20, search_string = "" } = req.body;
        const projectQuery = {orgId, 
            $or: [
              {name: { $regex: search_string, $options: "i" }},
              {description: { $regex: search_string, $options: "i" }},
            ],
        }
        const docs = await Project.find(projectQuery).skip(Number(skip)).limit(Number(limit)).sort({createdAt: -1}).populate('members');
        const totalCount = await Project.countDocuments(projectQuery);
        const data = {docs, totalCount};
        return res.status(200).json({data, message: docs.length > 0 ? 'Projects retrived.' : 'Project not found.', success: true});
    } catch (err) {
        return res.status(500).json({ error: err.message, message: err.message || 'Something went wrong.' });
    }
};

// Update Project
export const updateProject = async (req, res) => {
    try {
        let { orgId } = req.user;
        let doc = await Project.findOne({uuid: req.params.projectId, orgId });
        const message = doc == null ? 'Project not found.' : 'Project Updated';
        if(doc == null){
            return res.status(404).json({error: message, message});
        }
        Object.assign(doc, req.body); // safely updates fields on the Mongoose doc
        const updatedDoc = await doc.save();
        return res.status(200).json({data: updatedDoc, message, success: true});
    } catch (err) {
        return res.status(500).json({ error: err.message, message: err.message || 'Something went wrong.' });
    }
};

// Delete Project
export const deleteProject = async (req, res) => {
    try {
        let { orgId } = req.user;
        let doc = await Project.findOne({uuid: req.params.projectId, orgId });
        const message = doc == null ? 'Project not found.' : 'Project Deleted';
        if(doc == null){
            return res.status(404).json({error: message, message});
        }
        const updatedDoc = await doc.deleteOne();
        return res.status(200).json({data: updatedDoc, message, success: true});
    } catch (error) {
        return res.status(500).json({ error: err.message, message: err.message || 'Something went wrong.' });
    }
}

// Assign Members
export const assignMembers = async (req, res) => {
    try {
        let message = "Member assigned.";
        let {orgId, uuid} = req.user;
        let {projectId = '', expiryDate, memberIds = []} = req.body;
        if(projectId.trim() == '' || memberIds == null || !Array.isArray(memberIds) || memberIds.length < 1 || expiryDate == null) {
            return res.status(400).json({error: "Project id, member id, and expiry time is required."});
        }
        // Validation for date
        const isValidDate = !isNaN(Date.parse(expiryDate));
        if (!isValidDate) {
            message = 'Invalid date format.';
            return res.status(400).json({ data: null, message });
        }
        const formattedTime = moment(expiryDate).endOf('date').utc().toDate();
        // ✅ Step 1: Check if all employees exist in the User collection
        const existingUsers = await Employee.find({ uuid: { $in: memberIds }, orgId }, 'uuid');    
        const existingUserIds = existingUsers.map(user => user.uuid.toString());
        const missingUsers = memberIds.filter(id => !existingUserIds.includes(id));
    
        if (missingUsers.length > 0) {
            return res.status(400).json({ error: `The ${missingUsers.length} employee do not exist or do not belong to this organization.`});
        }
    
        // ✅ Step 2: Find existing members
        const existingAssignee = await ProjectMember.find({employeeId: {$in: memberIds}, projectId, orgId }, "employeeId");
        const preAssignedIds = existingAssignee.map((doc) => doc.employeeId);
        const alreadyAssignedMembers = memberIds.filter((id) => preAssignedIds.includes(id));
        const unAssignedMember = memberIds.filter((item) => !preAssignedIds.includes(item));
        // ✅ Step 3: Update expiry date for already assigned members
        await ProjectMember.updateMany(
            {
              employeeId: { $in: alreadyAssignedMembers },
              projectId,
              orgId,
            },
            { $set: { expiryDate: formattedTime } }
        );
        // ✅ Step 4: Insert new members
        const newRecords = unAssignedMember.map((item) => ({projectId, employeeId: item, orgId, expiryDate: formattedTime, createdBy: uuid}));
        const createdRecords = await ProjectMember.insertMany(newRecords);
        return res.status(201).json({data: createdRecords, message, success: true});
    } catch (err) {
        return res.status(500).json({ error: err.message, message: err.message || 'Something went wrong.' });
    }
}

// Remove Members
export const removeMember = async (req, res) => {
    try {
        let message = "Member removed.";
        let {orgId} = req.user;
        let {projectId = '', memberId} = req.body;
        if(projectId.trim() == '' || memberId == null || !String(memberId)) {
            return res.status(400).json({error: "Project id, member id is required."});
        }
        // Find Member for this project
        const record = await ProjectMember.findOne({employeeId: memberId, projectId, orgId });
        if(record == null || !record){
            message = "Employee is not available in this project.";
            return res.status(404).json({error: message, message});
        }
        const result = await record.deleteOne();
        return res.status(201).json({data: result, message, success: true});
    } catch (err) {
        return res.status(500).json({ error: err.message, message: err.message || 'Something went wrong.' });
    }
}

// Get Members
export const getProjectMembers = async (req, res) => {
    try {
        let message = "Member retrived.";
        let {orgId} = req.user;
        const projectId = req.params.projectId;
        let {skip=0, limit=50} = req.query;
        skip = parseInt(skip);
        limit = parseInt(limit);
        if(projectId == null || projectId.trim() == '' || isNaN(skip) || isNaN(limit)) {
            message = projectId == null || projectId.trim() == '' ? "ProjectID is required." : "Invalid skip limit value.";
            return res.status(400).json({error: message, message});
        }
        const projectRec = await Project.findOne({uuid: projectId, orgId});
        if(!projectRec || projectRec == null){
            return res.status(404).json({error: "Project not found.", message: "Project not found."});
        }
        const records = await ProjectMember.find({projectId, orgId }).skip(skip).limit(limit).populate({path: 'employeeDetail',
            select: 'name email uuid',}).lean({virtuals: true});
        // const employees = await Employee.find({uuid: {$in: records}}, "email name uuid");
        return res.status(200).json({data: records, message, success: true});
    } catch (err) {
        return res.status(500).json({ error: err.message, message: err.message || 'Something went wrong.' });
    }
}
// Get Member count
export const getProjectMemberCount = async (req, res) => {
    try {
        let message = "Count retrived.";
        let {orgId} = req.user;
        const projectId = req.params.projectId;
        const recordCount = await ProjectMember.countDocuments({projectId, orgId });
        return res.status(200).json({data: recordCount, message, success: true});
    } catch (err) {
        return res.status(500).json({ error: err.message, message: err.message || 'Something went wrong.' });
    }
}

// Get Assinged project
export const getAssignedProject = async (req, res) => {
    try {
        let message = "Projects retrived.";
        let {orgId, uuid} = req.user;
        let {skip=0, limit=20} = req.query;
        skip = parseInt(skip);
        limit = parseInt(limit);
        if(isNaN(skip) || isNaN(limit)) {
            message = "Invalid skip limit value.";
            return res.status(400).json({error: message, message});
        }
        const docs = await ProjectMember.find({employeeId: uuid, orgId }).skip(skip).limit(limit).populate({path: 'projectDetail', select: 'name',}).lean({virtuals: true});
        const totalCount = await ProjectMember.countDocuments({employeeId: uuid, orgId });
        return res.status(200).json({data: {docs, totalCount}, message, success: true});
    } catch (err) {
        return res.status(500).json({ error: err.message, message: err.message || 'Something went wrong.' });
    }
}