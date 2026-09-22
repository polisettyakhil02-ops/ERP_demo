// routes/feeStructureRoutes.js
import { Router } from "express";
import {
  listFeeStructures,
  createFeeStructure,
  updateFeeStructure,
  deleteFeeStructure,
} from "../controllers/feeStructureController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", listFeeStructures);
router.post("/", createFeeStructure);
router.put("/:id", updateFeeStructure);
router.delete("/:id", deleteFeeStructure);

export default router;
