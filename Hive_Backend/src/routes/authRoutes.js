import express from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/auth.js";
import {
  login,
  refresh,
  logout,
  me,
  verifyPassword,
  changePassword,
  updateMe,
} from "../controllers/authController.js";

const router = express.Router();

// Slow down brute-force attempts on login specifically.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many login attempts. Please try again in a few minutes.",
  },
});

router.post("/login", loginLimiter, login);
router.post("/refresh", refresh);

router.use(requireAuth);

router.post("/logout", logout);
router.get("/me", me);
router.put("/me", updateMe);
router.post("/verify-password", verifyPassword);
router.put("/change-password", changePassword);

// Staff accounts are managed through /api/users (see userRouter.js).

export default router;
