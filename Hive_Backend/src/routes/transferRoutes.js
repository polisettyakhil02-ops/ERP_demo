// routes/transferRoutes.js
import express from "express";

import { requireAuth } from "../middleware/auth.js";
import { transferStudent } from "../controllers/transferController.js";

const transferRoutes = express.Router();

transferRoutes.use(requireAuth);

// Single entry point for all 7 transfer types - see transferController.js.
transferRoutes.post("/", transferStudent);

export default transferRoutes;
