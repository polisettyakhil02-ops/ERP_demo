// controllers/schoolController.js
import School from "../models/School.js";
import Branch from "../models/Branch.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { normalizeSchoolName } from "../utils/schoolName.js";

// GET /api/schools - any authenticated user (Add Branch's school picker and
// branding lookups need this regardless of role). Pass ?activeOnly=true to
// hide deactivated schools (used by pickers; the management table wants all).
export const list = async (req, res) => {
  try {
    const filter = req.query.activeOnly === "true" ? { is_active: true } : {};
    const schools = await School.find(filter).sort({ name: 1 }).lean();
    return res.json({ success: true, data: schools });
  } catch (err) {
    console.error("schools.list error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch schools." });
  }
};

// POST /api/schools - Super Admin only (see schoolRoutes.js)
export const create = asyncHandler(async (req, res) => {
  const { name, logoUrl, faviconUrl } = req.body;

  if (!name || !logoUrl || !faviconUrl) {
    throw new ApiError(400, "name, logoUrl and faviconUrl are required.");
  }

  const existing = await School.findOne({
    name: { $regex: `^${name.trim()}$`, $options: "i" },
  });
  if (existing) {
    throw new ApiError(409, "A school with this name already exists.");
  }

  const school = await School.create({ name: name.trim(), logoUrl, faviconUrl });
  res.status(201).json({ success: true, data: school });
});

// PUT /api/schools/:id - Super Admin only
export const update = asyncHandler(async (req, res) => {
  const { name, logoUrl, faviconUrl, is_active } = req.body;
  const school = await School.findById(req.params.id);
  if (!school) throw new ApiError(404, "School not found.");

  // Branch.schoolName is matched against School.name as free text (see
  // utils/schoolName.js) - renaming a school here would silently orphan
  // every branch still carrying the old name, so it's blocked rather than
  // guessed at. Logo/favicon/status can still be changed freely.
  if (name !== undefined && normalizeSchoolName(name) !== normalizeSchoolName(school.name)) {
    throw new ApiError(
      400,
      "Renaming a school isn't supported yet - existing branches reference it by name.",
    );
  }
  if (logoUrl !== undefined) school.logoUrl = logoUrl;
  if (faviconUrl !== undefined) school.faviconUrl = faviconUrl;
  if (is_active !== undefined) school.is_active = is_active;

  await school.save();
  res.json({ success: true, data: school });
});

// DELETE /api/schools/:id - Super Admin only. Soft-delete, blocked if any
// active branch still carries this school's name - matches the Branch
// soft-delete convention (branchController.remove blocks on active staff).
export const remove = asyncHandler(async (req, res) => {
  const school = await School.findById(req.params.id);
  if (!school) throw new ApiError(404, "School not found.");

  const branches = await Branch.find({ is_active: true }, "schoolName").lean();
  const branchCount = branches.filter(
    (b) => normalizeSchoolName(b.schoolName) === normalizeSchoolName(school.name),
  ).length;
  if (branchCount > 0) {
    throw new ApiError(
      409,
      `Cannot deactivate — ${branchCount} active branch(es) still belong to this school.`,
    );
  }

  school.is_active = false;
  await school.save();
  res.json({ success: true, data: school });
});
