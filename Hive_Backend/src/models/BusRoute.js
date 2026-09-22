// models/BusRoute.js
//
// Master data for a branch's bus routes - Student.transport_route is (and
// stays) a free-text label with no backing route data; this is the
// structured counterpart an Admin Officer manages directly, one flat fee
// per full route (not per-stop) rather than a leg-by-leg fare table.
import mongoose from "mongoose";
import { withCommonFields } from "./_baseSchema.js";

const busRouteSchema = new mongoose.Schema({
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Branch",
    required: true,
    index: true,
  },
  route_name: { type: String, required: true, trim: true },
  // From/To are optional - only route_name, branch, and fee_amount are
  // mandatory (enforced by the form; not required at the schema level).
  route_from: { type: String, trim: true, default: "" },
  route_to: { type: String, trim: true, default: "" },
  // In-between places, in order along the route - free text, no fixed
  // count, matching how the form lets an Admin Officer add/remove stops.
  stops: { type: [String], default: [] },
  // Single flat fee for the full route, charged yearly (not per-stop, not
  // per-term) - see the form's "Fee Amount (Yearly)" label.
  fee_amount: { type: Number, required: true, min: 0 },
});

withCommonFields(busRouteSchema);

// One route name per branch at a time - same soft-delete-aware uniqueness
// pattern as Class/FeeStructure, so a deleted route's name can be reused.
busRouteSchema.index(
  { branch: 1, route_name: 1 },
  { unique: true, partialFilterExpression: { is_deleted: false } },
);

export default mongoose.model("BusRoute", busRouteSchema);
