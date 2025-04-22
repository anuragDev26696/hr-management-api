import express from 'express';
import { authGuard, checkPermission } from "../middleware/auth.js";
import { assignMembers, createProject, deleteProject, getAssignedProject, getProjectById, getProjectMemberCount, getProjectMembers, getProjects, removeMember, updateProject } from '../controllers/project.controller.js';

const router = express.Router();

router.post('/create-new', authGuard, checkPermission("project"), createProject);
router.get('/:projectId', authGuard, getProjectById);
router.patch('/:projectId', authGuard, checkPermission("project"), updateProject);
router.post('/search', authGuard, checkPermission("project"), getProjects);
router.delete('/:projectId', authGuard, checkPermission("project"), deleteProject);
router.post('/assign-member', authGuard, checkPermission("project"), assignMembers);
router.put('/remove-member', authGuard, checkPermission("project"), removeMember);
router.get('/project-members/:projectId', authGuard, getProjectMembers);
router.get('/member-count/:projectId', authGuard, getProjectMemberCount);
router.get('/assigned/project', authGuard, getAssignedProject);

const projectRoutes = router;
export default projectRoutes;