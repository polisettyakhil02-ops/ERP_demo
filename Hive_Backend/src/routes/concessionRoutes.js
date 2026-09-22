import { Router } from "express";
import * as concessionController from "../controllers/concessionController.js";
import { requireAuth } from "../middleware/auth.js";

const concessionRoutes = Router();
concessionRoutes.use(requireAuth);

concessionRoutes.get("/", concessionController.list);
concessionRoutes.post("/", concessionController.create);
concessionRoutes.put("/:id/approve", concessionController.approve);
concessionRoutes.put("/:id/reject", concessionController.reject);

export default concessionRoutes;
