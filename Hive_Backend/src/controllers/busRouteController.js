// controllers/busRouteController.js
import BusRoute from "../models/BusRoute.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { isAllowed } from "../rbac/permissions.js";
import {
  buildScopeFilter,
  resolveBranchQueryFilter,
  sanitizeAndScopeBody,
} from "../middleware/branchScope.js";

function assertAllowed(action, role) {
  if (!isAllowed("BusRoute", action, role)) {
    throw new ApiError(403, `Your role is not permitted to ${action} bus routes.`);
  }
}

function friendlyDuplicateError(err) {
  if (err?.code !== 11000) return null;
  return "A bus route with this name already exists for this branch.";
}

// Stops arrive from the form as a plain string array - drop any blank
// entries (an empty "add another stop" row left untouched) rather than
// storing them.
function cleanStops(stops) {
  if (!Array.isArray(stops)) return [];
  return stops.map((s) => String(s).trim()).filter(Boolean);
}

// GET /api/bus-routes  (params: branch?)
//
// Branch scoping goes through resolveBranchQueryFilter, NOT buildScopeFilter
// alone: buildScopeFilter deliberately adds no branch clause for
// multi-branch roles, so an admin_officer calling this with no ?branch=
// used to receive every BusRoute in the database - other schools included -
// and a ?branch= naming a branch they aren't assigned to was passed
// straight through unchecked. resolveBranchQueryFilter is the same helper
// userController.list already uses: no param means "every branch I'm
// assigned to", a param narrows to it, and a branch outside user.branches
// comes back `allowed: false` so we 403 instead of leaking it.
export const listBusRoutes = asyncHandler(async (req, res) => {
  assertAllowed("read", req.user.role);
  const { allowed, filter } = resolveBranchQueryFilter(req.user, req.query.branch);
  if (!allowed) throw new ApiError(403, "You do not have access to that branch.");
  // buildScopeFilter still supplies the non-branch parts of the scope
  // (is_deleted), so its branch clause - when it sets one, for single-branch
  // roles - is overwritten by the resolved one rather than fighting it.
  const matchFilter = { ...buildScopeFilter("BusRoute", req.user), ...filter };

  // ?summary=branch - route count and total yearly fee per branch, for the
  // branch cards. Returns one small row per branch instead of every route,
  // so the card screen's cost stays flat as branches are added.
  if (req.query.summary === "branch") {
    const summary = await BusRoute.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: "$branch",
          total: { $sum: 1 },
          fee_total: { $sum: { $ifNull: ["$fee_amount", 0] } },
        },
      },
    ]);
    return res.json({
      data: summary.map((r) => ({
        branch: r._id,
        total: r.total,
        fee_total: r.fee_total,
      })),
    });
  }

  const rows = await BusRoute.find(matchFilter)
    .populate("branch", "name code")
    .sort({ route_name: 1 })
    .lean();

  res.json({ data: rows, total: rows.length });
});

// POST /api/bus-routes
export const createBusRoute = asyncHandler(async (req, res) => {
  assertAllowed("create", req.user.role);
  const body = sanitizeAndScopeBody("BusRoute", req.user, req.body);
  body.stops = cleanStops(body.stops);

  try {
    const doc = await BusRoute.create({
      ...body,
      created_by: req.user._id,
      updated_by: req.user._id,
    });
    res.status(201).json(doc);
  } catch (err) {
    const friendly = friendlyDuplicateError(err);
    if (friendly) throw new ApiError(409, friendly);
    throw err;
  }
});

// PUT /api/bus-routes/:id
export const updateBusRoute = asyncHandler(async (req, res) => {
  assertAllowed("update", req.user.role);
  const scope = buildScopeFilter("BusRoute", req.user);
  const clean = sanitizeAndScopeBody("BusRoute", req.user, req.body);
  // Branch is fixed once a route is created - same convention as
  // FeeStructure, since re-pointing a route at a different branch is
  // really a new route, not an edit of this one.
  delete clean.branch;
  if ("stops" in clean) clean.stops = cleanStops(clean.stops);

  try {
    const doc = await BusRoute.findOne({ _id: req.params.id, ...scope });
    if (!doc) throw new ApiError(404, "Bus route not found.");
    Object.assign(doc, clean);
    doc.updated_by = req.user._id;
    await doc.save();
    res.json(doc);
  } catch (err) {
    const friendly = friendlyDuplicateError(err);
    if (friendly) throw new ApiError(409, friendly);
    throw err;
  }
});

// DELETE /api/bus-routes/:id  (soft delete)
export const deleteBusRoute = asyncHandler(async (req, res) => {
  assertAllowed("delete", req.user.role);
  const scope = buildScopeFilter("BusRoute", req.user);
  const doc = await BusRoute.findOneAndUpdate(
    { _id: req.params.id, ...scope },
    { is_deleted: true, deleted_at: new Date(), updated_by: req.user._id },
    { new: true },
  );
  if (!doc) throw new ApiError(404, "Bus route not found.");
  res.json({ success: true, id: doc._id });
});
