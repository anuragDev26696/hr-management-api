import { Router } from "express";
import { login, setPassword } from "../controllers/auth.controller.js";
import { newUser } from "../controllers/employee.controller.js";

const routes = Router();
routes.post("/login", login);
routes.post("/setPassword", setPassword);
routes.post("/register", newUser);

const authRoute = routes;
export default authRoute;