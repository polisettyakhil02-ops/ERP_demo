// routes/studentRoutes.js
import { Router } from "express";
import {
  listStudents,
  exportStudents,
  getStudentById,
  createStudent,
  bulkCreateStudents,
  updateStudent,
  promoteStudents,
  deleteStudent,
  requestDeleteStudent,
  withdrawDeleteRequestStudent,
  approveDeleteRequestStudent,
  rejectDeleteRequestStudent,
  requestStatusChangeStudent,
  withdrawStatusChangeRequestStudent,
  approveStatusChangeRequestStudent,
  rejectStatusChangeRequestStudent,
  requestAdditionStudent,
  listAdditionRequestsStudent,
  approveAdditionRequestStudent,
  rejectAdditionRequestStudent,
  withdrawAdditionRequestStudent,
} from "../controllers/studentController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ROLES } from "../config/constants.js";

const studentRoutes = Router();
studentRoutes.use(requireAuth);

// Addition-approval workflow: Accounts Manager requests/withdraws, Admin
// Officer approves/rejects (scoped to their assigned branches - see
// isBranchAdminOfficer in studentController.js). Registered ABOVE "/:id"
// below - Express would otherwise match "/addition-requests" itself as an
// :id value on that route.
studentRoutes.post(
  "/addition-requests",
  requireRole(ROLES.ACCOUNTS_MANAGER),
  requestAdditionStudent,
);
studentRoutes.get("/addition-requests", listAdditionRequestsStudent);
studentRoutes.put(
  "/addition-requests/:id/approve",
  requireRole(ROLES.ADMIN_OFFICER),
  approveAdditionRequestStudent,
);
studentRoutes.put(
  "/addition-requests/:id/reject",
  requireRole(ROLES.ADMIN_OFFICER),
  rejectAdditionRequestStudent,
);
studentRoutes.put("/addition-requests/:id/withdraw", withdrawAdditionRequestStudent);

// Before "/:id" below, or Express reads "export" as a student id.
studentRoutes.get("/export", exportStudents);
studentRoutes.get("/", listStudents);
studentRoutes.get("/:id", getStudentById);
studentRoutes.post("/", createStudent);
studentRoutes.post("/bulk", bulkCreateStudents);
studentRoutes.post("/promote", promoteStudents);
studentRoutes.put("/:id", updateStudent);
studentRoutes.delete("/:id", deleteStudent);

// Deletion-approval workflow: Accounts Manager requests/withdraws, Admin
// Officer approves/rejects (scoped to their assigned branches - see
// isBranchAdminOfficer in studentController.js). See studentController.js
// for the full flow.
studentRoutes.post(
  "/:id/request-delete",
  requireRole(ROLES.ACCOUNTS_MANAGER),
  requestDeleteStudent,
);
studentRoutes.post(
  "/:id/withdraw-delete-request",
  requireRole(ROLES.ACCOUNTS_MANAGER),
  withdrawDeleteRequestStudent,
);
studentRoutes.post(
  "/:id/approve-delete",
  requireRole(ROLES.ADMIN_OFFICER),
  approveDeleteRequestStudent,
);
studentRoutes.post(
  "/:id/reject-delete",
  requireRole(ROLES.ADMIN_OFFICER),
  rejectDeleteRequestStudent,
);

// Status-change-approval workflow: Accounts Manager requests/withdraws,
// Principal approves/rejects. See studentController.js for the full flow.
studentRoutes.post(
  "/:id/request-status-change",
  requireRole(ROLES.ACCOUNTS_MANAGER),
  requestStatusChangeStudent,
);
studentRoutes.post(
  "/:id/withdraw-status-change-request",
  requireRole(ROLES.ACCOUNTS_MANAGER),
  withdrawStatusChangeRequestStudent,
);
studentRoutes.post(
  "/:id/approve-status-change",
  requireRole(ROLES.PRINCIPAL),
  approveStatusChangeRequestStudent,
);
studentRoutes.post(
  "/:id/reject-status-change",
  requireRole(ROLES.PRINCIPAL),
  rejectStatusChangeRequestStudent,
);

export default studentRoutes;
