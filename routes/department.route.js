import { Router } from "express";
import { createDepartment, deleteDepartment, getAll, getSingleDepartment, updateDepartment } from "../controllers/department.js";
import { adminGuard, authGuard } from "../middleware/auth.js";

const routes = Router();
routes.post("/", authGuard, adminGuard, createDepartment);
routes.patch("/:id", authGuard, adminGuard, updateDepartment);
routes.post("/search", authGuard, getAll);
routes.get("/:id", authGuard, getSingleDepartment);
routes.delete("/:id", authGuard, adminGuard, deleteDepartment);

const departmentRoutes = routes;
export default departmentRoutes;