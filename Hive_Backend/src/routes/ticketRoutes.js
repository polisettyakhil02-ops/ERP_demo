import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { uploadMemory } from "../middleware/uploadMemory.js";
import { createTicket, getMyTickets } from "../controllers/ticketController.js";

const router = express.Router();
router.use(requireAuth);

router.get("/mine", getMyTickets);
router.post("/", uploadMemory.single("image"), createTicket);

export default router;
