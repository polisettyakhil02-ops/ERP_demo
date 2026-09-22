import { Router } from "express";
import * as backDateRequestController from "../controllers/backDateRequestController.js";
import { requireAuth } from "../middleware/auth.js";

const backDateRequestRoutes = Router();
backDateRequestRoutes.use(requireAuth);

backDateRequestRoutes.post("/", backDateRequestController.create);
backDateRequestRoutes.get("/available", backDateRequestController.listAvailable);
backDateRequestRoutes.put("/:id/approve", backDateRequestController.approve);
backDateRequestRoutes.put("/:id/reject", backDateRequestController.reject);

export default backDateRequestRoutes;
