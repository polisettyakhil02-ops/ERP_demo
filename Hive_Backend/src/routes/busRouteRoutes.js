// routes/busRouteRoutes.js
import { Router } from "express";
import {
  listBusRoutes,
  createBusRoute,
  updateBusRoute,
  deleteBusRoute,
} from "../controllers/busRouteController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", listBusRoutes);
router.post("/", createBusRoute);
router.put("/:id", updateBusRoute);
router.delete("/:id", deleteBusRoute);

export default router;
