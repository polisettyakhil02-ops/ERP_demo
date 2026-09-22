import "dotenv/config";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import User from "../models/User.js";
import School from "../models/School.js";
import { BRANCHES, ROLES } from "../config/constants.js";
import { UPLOAD_ROOT } from "../middleware/upload.js";

// The two schools that predate the School collection - their logo/favicon
// source files still live in the frontend's own /public (that part of this
// dev checkout hasn't changed), but every School.logoUrl/faviconUrl in the
// database is an uploaded, backend-hosted absolute URL, same as any school
// added through the Manage Schools page - so these are copied into
// uploads/schools/ here rather than seeded as frontend-relative paths,
// which would silently reintroduce that inconsistency on a fresh DB.
const BASE_URL = process.env.MIGRATION_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
const FRONTEND_PUBLIC = path.resolve("../Hive_Frontend/public");
const SCHOOLS_UPLOAD_DIR = path.join(UPLOAD_ROOT, "schools");

const LEGACY_SCHOOLS = [
  { name: "Master Minds", logo: "logo.webp", favicon: "favicon-masterminds.png" },
  { name: "Krishnaveni Talent School", logo: "KTS.jpg", favicon: "favicon-krishnaveni.png" },
];

function copyIntoUploads(sourceFileName) {
  const sourcePath = path.join(FRONTEND_PUBLIC, sourceFileName);
  const ext = path.extname(sourceFileName);
  const destFileName = `${Date.now()}-${crypto.randomBytes(16).toString("hex")}${ext}`;
  fs.copyFileSync(sourcePath, path.join(SCHOOLS_UPLOAD_DIR, destFileName));
  return `${BASE_URL}/uploads/schools/${destFileName}`;
}

async function seed() {
  await connectDB();

  for (const s of LEGACY_SCHOOLS) {
    const existing = await School.findOne({ name: s.name });
    if (!existing) {
      await School.create({
        name: s.name,
        logoUrl: copyIntoUploads(s.logo),
        faviconUrl: copyIntoUploads(s.favicon),
      });
      console.log(`[seed] Created School: ${s.name}`);
    } else {
      console.log(`[seed] School already exists: ${s.name}`);
    }
  }

  // Super Admin - role is now active (SUPER_ADMIN_ENABLED in config/constants.js).
  const superAdminEmail = (process.env.SEED_SUPER_ADMIN_EMAIL || "superadmin@masterminds.edu").toLowerCase();
  let superAdmin = await User.findOne({ email: superAdminEmail });
  if (!superAdmin) {
    superAdmin = await User.create({
      full_name: "Super Admin",
      email: superAdminEmail,
      password: process.env.SEED_SUPER_ADMIN_PASSWORD || "ChangeThisPassword123!",
      role: ROLES.SUPER_ADMIN,
      branch: null,
      // User.schoolName is required on every role (see models/User.js) even
      // though Super Admin isn't tied to one school - just a nominal home
      // value, unused for access control (branchController.list already
      // gives super_admin every branch regardless of this field).
      schoolName: "Master Minds",
    });
    console.log(`[seed] Created Super Admin: ${superAdmin.email} - rotate SEED_SUPER_ADMIN_PASSWORD before using this in a shared environment.`);
  } else {
    console.log(`[seed] Super Admin already exists: ${superAdmin.email}`);
  }

  // One Principal account for the first branch, so there's a working login immediately.
  const principalEmail = (process.env.SEED_PRINCIPAL_EMAIL || "principal.hyderabad@masterminds.edu").toLowerCase();
  let principal = await User.findOne({ email: principalEmail });
  if (!principal) {
    principal = await User.create({
      full_name: "Principal - Hyderabad",
      email: principalEmail,
      password: process.env.SEED_PRINCIPAL_PASSWORD || "ChangeThisPassword123!",
      role: ROLES.PRINCIPAL,
      branch: BRANCHES[0],
    });
    console.log(`[seed] Created Principal: ${principal.email} / branch: ${principal.branch}`);
  } else {
    console.log(`[seed] Principal already exists: ${principal.email}`);
  }

  console.log("\n[seed] Done. Use the Principal account to log in and create");
  console.log("[seed] Admin Officer / Accounts Manager / Teacher / Student accounts");
  console.log("[seed] via POST /api/auth/users.\n");

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("[seed] Failed:", err);
  process.exit(1);
});
