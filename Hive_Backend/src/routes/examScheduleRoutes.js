import express from "express";
import { requireAuth } from "../middleware/auth.js";
import * as examScheduleController from "../controllers/examScheduleController.js";

const examScheduleRouter = express.Router();

examScheduleRouter.use(requireAuth);

examScheduleRouter.get("/", examScheduleController.list);
examScheduleRouter.post("/", examScheduleController.create);
examScheduleRouter.put("/:id", examScheduleController.update);
examScheduleRouter.delete("/:id", examScheduleController.remove);

export default examScheduleRouter;
