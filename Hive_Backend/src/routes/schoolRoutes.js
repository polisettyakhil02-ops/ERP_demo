import express from "express";

import { requireAuth, requireRole } from "../middleware/auth.js";
import { ROLES } from "../config/constants.js";
import * as schoolController from "../controllers/schoolController.js";

const schoolRouter = express.Router();

schoolRouter.use(requireAuth);

schoolRouter.get("/", schoolController.list);
schoolRouter.post(
  "/",
  requireRole(ROLES.SUPER_ADMIN),
  schoolController.create,
);
schoolRouter.put(
  "/:id",
  requireRole(ROLES.SUPER_ADMIN),
  schoolController.update,
);
schoolRouter.delete(
  "/:id",
  requireRole(ROLES.SUPER_ADMIN),
  schoolController.remove,
);

export default schoolRouter;
