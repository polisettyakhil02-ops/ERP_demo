import crypto from "crypto";
import Staff from "../models/Staff.js";
import User from "../models/User.js";
import Branch from "../models/Branch.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";

function slugify(str = "") {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function generateUniqueTeacherEmail(branch, fullName) {
  const branchSlug = slugify(branch);
  const nameSlug = slugify(fullName);
  let suffix = "";
  let counter = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const email = `${branchSlug}.${nameSlug}${suffix}@masterminds.com`;
    const existing = await User.findOne({ email });
    if (!existing) return email;
    counter += 1;
    suffix = String(counter);
  }
}

// GET /api/public/branches
// Mirrors entities.Branch.list() but reachable with no session - the
// authenticated /api/entities/Branch route is useless to an anonymous
// visitor on a public registration page.
export const listPublicBranches = asyncHandler(async (req, res) => {
  const branches = await Branch.find({
    is_active: { $ne: false },
  }).lean();

  res.json(branches);
});

// POST /api/public/teacher-registration
// Anyone can reach this without logging in, so it must never hand out a
// working login. The account is created inactive with a random password
// that is never returned; it shows up on the branch's Staff page, where
// the Principal (or Accounts Manager) activates it and sets a password.
export const registerTeacher = asyncHandler(async (req, res) => {
  const { full_name, branch, phone, subjects, classes_taught, qualification } =
    req.body;

  if (!full_name || !branch || !phone) {
    throw new ApiError(400, "full_name, branch and phone are required.");
  }
  if (typeof phone !== "string" || !/^[6-9]\d{9}$/.test(phone)) {
    throw new ApiError(400, "Phone must be a valid 10-digit mobile number.");
  }
  if (!Array.isArray(subjects) || subjects.length === 0) {
    throw new ApiError(400, "Select at least one subject.");
  }
  if (!Array.isArray(classes_taught) || classes_taught.length === 0) {
    throw new ApiError(400, "Select at least one class.");
  }

  const branchDoc = await Branch.findOne({
    _id: branch,
    is_active: { $ne: false },
  });
  if (!branchDoc) {
    throw new ApiError(400, "Branch not found.");
  }

  const existingPhone = await Staff.findOne({
    phone,
    is_deleted: { $ne: true },
  });
  if (existingPhone) {
    throw new ApiError(409, "Phone number already exists.");
  }

  const staff = await Staff.create({
    full_name,
    branch: branchDoc._id,
    phone,
    subjects,
    classes_taught,
    qualification,
    role: "teacher",
    status: "Active",
    joining_date: new Date(),
  });

  const email = await generateUniqueTeacherEmail(branchDoc.name, full_name);
  try {
    await User.create({
      full_name,
      email,
      // Never shown to anyone - whoever activates the account sets the
      // real password from the Staff page.
      password: crypto.randomBytes(12).toString("base64url"),
      role: "teacher",
      branch: branchDoc._id,
      schoolName: branchDoc.schoolName || "Master Minds Default",
      phone,
      subject_taught: subjects,
      qualification,
      is_active: false,
    });
  } catch (err) {
    // Don't leave a Staff record behind without its login.
    await Staff.deleteOne({ _id: staff._id });
    throw err;
  }

  res.status(201).json({
    email,
    message:
      "Registration received. Your Principal will activate your login and share your password.",
  });
});
