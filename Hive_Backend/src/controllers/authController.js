import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/tokens.js";
import { ACTIVE_ROLES } from "../config/constants.js";

const DUMMY_HASH =
  "$2b$12$LQv3c1yqSNWvlk7EPYg28e0Qv6X09i46u7H/kR6nLzZ1L6IuLg27W"; // A pre-computed dummy hash for constant-time comparison (prevents timing attacks)
const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/api/auth/refresh",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};
function issueTokens(user) {
  return {
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user),
  };
}

// POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const allowedFields = ["email", "password"];
  const bodyKeys = Object.keys(req.body);

  const hasExtraFields = bodyKeys.some((key) => !allowedFields.includes(key));
  if (hasExtraFields || bodyKeys.length !== 2) {
    throw new ApiError(400, "Invalid email or password.");
  }

  const { email, password } = req.body;

  // 2. Strict Type Enforcement (Stops NoSQL objects like { $gt: "" })
  if (
    !email ||
    !password ||
    typeof email !== "string" ||
    typeof password !== "string"
  ) {
    throw new ApiError(400, "Invalid email or password.");
  }

  // 3. Length Constraints (Prevents Denial of Service & enforces password policy silently)
  if (email.length > 80 || password.length < 10 || password.length > 20) {
    throw new ApiError(400, "Invalid email or password.");
  }

  // 4. Strict Email Format Verification
  const emailRegex = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;
  const trimmedEmail = email.toLowerCase().trim();

  if (!emailRegex.test(trimmedEmail)) {
    throw new ApiError(400, "Invalid email or password.");
  }

  // 5. Deep Injection Pattern Shield (Restricted strictly to email format validation)
  const maliciousPattern =
    /(\$|\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|EXEC|SCRIPT)\b)/i;
  if (maliciousPattern.test(trimmedEmail)) {
    throw new ApiError(400, "Invalid email or password.");
  }

  // 6. Safe Query Execution (Explicit String Casting)
  const user = await User.findOne({ email: String(trimmedEmail) }).select(
    "+password",
  );

  // 7. Timing Attack Mitigation
  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    throw new ApiError(401, "Invalid email or password.");
  }

  // 8. Account Status & Role Validation
  if (!user.is_active) {
    throw new ApiError(
      403,
      "This account has been deactivated. Contact your administrator.",
    );
  }

  if (!ACTIVE_ROLES.includes(user.role)) {
    throw new ApiError(403, "This role is not currently active.");
  }

  // 9. Password Comparison Validation
  const valid = await user.comparePassword(password);
  if (!valid) {
    throw new ApiError(401, "Invalid email or password.");
  }

  user.last_login_at = new Date();
  await user.save();

  const { accessToken, refreshToken } = issueTokens(user);

  res.cookie("refreshToken", refreshToken, refreshCookieOptions);

  res.json({
    user: {
      _id: user._id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      branch: user.branch,
      branches: user.branches,
      address: user.address,
      schoolName: user.schoolName,
      subject_taught: user.subject_taught,
    },
    accessToken,
  });
});

// POST /api/auth/refresh
export const refresh = asyncHandler(async (req, res) => {
  console.log("refresh token hitting");
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) throw new ApiError(400, "refreshToken is required.");

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new ApiError(
      401,
      "Invalid or expired refresh token. Please log in again.",
    );
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.is_active || user.refresh_token_version !== payload.v) {
    throw new ApiError(
      401,
      "Refresh token is no longer valid. Please log in again.",
    );
  }

  const { accessToken, refreshToken: newRefreshToken } = issueTokens(user);

  res.cookie("refreshToken", newRefreshToken, refreshCookieOptions);

  res.json({
    accessToken,
  });
});

// POST /api/auth/logout
export const logout = asyncHandler(async (req, res) => {
  req.user.refresh_token_version += 1;
  await req.user.save();

  res.clearCookie("refreshToken", {
    path: "/api/auth/refresh",
  });

  res.json({
    success: true,
  });
});

// GET /api/auth/me
export const me = asyncHandler(async (req, res) => {
  const user = await req.user.populate([
    { path: "branch", select: "name code phone address" },
    { path: "branches", select: "name code phone address" },
  ]);
  res.json(user.toSafeJSON());
});

// POST /api/auth/verify-password
// Checks the current password without changing anything - used by the
// profile page's change-password flow to gate the new-password fields
// behind a correct current password before showing them.
export const verifyPassword = asyncHandler(async (req, res) => {
  const { currentPassword } = req.body;
  if (!currentPassword) {
    throw new ApiError(400, "currentPassword is required.");
  }

  const user = await User.findById(req.user._id).select("+password");
  const valid = await user.comparePassword(currentPassword);
  if (!valid) throw new ApiError(401, "Current password is incorrect.");

  res.json({ valid: true });
});

// PUT /api/auth/change-password
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    throw new ApiError(400, "currentPassword and newPassword are required.");
  }
  // Same 10-20 char window the login form enforces (see login() above) -
  // a password outside it would lock the user out on their next login.
  if (newPassword.length < 10 || newPassword.length > 20) {
    throw new ApiError(
      400,
      "New password must be between 10 and 20 characters.",
    );
  }

  const user = await User.findById(req.user._id).select("+password");
  const valid = await user.comparePassword(currentPassword);
  if (!valid) throw new ApiError(401, "Current password is incorrect.");

  user.password = newPassword; // pre-save hook hashes it
  user.refresh_token_version += 1; // invalidate other sessions
  await user.save();

  res.json({ success: true });
});

// PUT /api/auth/me
// Self-service profile update - intentionally whitelisted to a single
// harmless field. A Teacher can't reach userController.update at all, and
// a Principal there can only edit Teacher records, not their own - so
// neither role has any other way to set their own signature_url (embedded
// on generated hall tickets, see classController.listClasses /
// HallTicket.jsx). Never touches role/branch/email/password here, even if
// the client sends them - self-service must never touch privilege-bearing
// fields.
export const updateMe = asyncHandler(async (req, res) => {
  req.user.signature_url = req.body.signature_url || null;
  await req.user.save();
  res.json(req.user.toSafeJSON());
});
