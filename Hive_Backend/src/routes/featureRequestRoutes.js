import express from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/auth.js";
import {
  chat,
  create,
  list,
  update,
} from "../controllers/featureRequestController.js";

const router = express.Router();
router.use(requireAuth);

// Every chat turn is a paid Claude API call - cap it per user, not per IP,
// so one account can't run up the bill and a shared school network doesn't
// lock everyone out.
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user._id),
  message: {
    error:
      "You've sent a lot of messages in a short time. Please wait a few minutes and try again.",
  },
});

router.post("/chat", chatLimiter, chat);
router.get("/", list);
router.post("/", create);
router.put("/:id", update);

export default router;
