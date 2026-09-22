import { ROLES } from "../config/constants.js";

const {
  SUPER_ADMIN,
  PRINCIPAL,
  ADMIN_OFFICER,
  ACCOUNTS_MANAGER,
  TEACHER,
  STUDENT,
} = ROLES;

/**
 * permission shape per entity:
 * {
 *   create: [roles],
 *   read:   [roles],
 *   update: [roles],
 *   delete: [roles],     // includes soft-delete, bulk-delete, restore
 *   // ownerScope: when true, a record can also be read/updated/deleted by the
 *   // role(s) listed in ownerScope even if their role isn't generally allowed,
 *   // as long as they created it / are the subject of it. Handled in the controller.
 *   studentOwnOnly: true // STUDENT role, if present in `read`, is restricted to records about themselves
 * }
 *
 * super_admin is implicitly allowed to do everything everywhere - enforced in
 * the middleware, not listed here, so this file doesn't get cluttered.
 */
export const PERMISSIONS = {
  User: {
    create: [PRINCIPAL, ADMIN_OFFICER, ACCOUNTS_MANAGER],
    read: [PRINCIPAL, ADMIN_OFFICER, ACCOUNTS_MANAGER],
    update: [PRINCIPAL, ADMIN_OFFICER, ACCOUNTS_MANAGER],
    // Accounts Manager deliberately excluded: they can only *request* a
    // staff deactivation (POST /:id/request-delete, route-gated separately
    // in userRouter.js), never deactivate directly - only Principal/Admin
    // Officer can via this permission-guarded DELETE /:id.
    delete: [PRINCIPAL, ADMIN_OFFICER],
  },
  Admission: {
    create: [ACCOUNTS_MANAGER, ADMIN_OFFICER],
    read: [PRINCIPAL, ADMIN_OFFICER, ACCOUNTS_MANAGER],
    update: [ACCOUNTS_MANAGER, ADMIN_OFFICER],
    delete: [ACCOUNTS_MANAGER],
  },
  // Payments collected against an Admission before it's converted to a
  // Student (Admission Fee / Registration Fee / Term Fee only) - same
  // create/read roles as FeePayment. No update/delete: there's no
  // cancel/reversal endpoint for admission payments yet.
  // "Enquiry" page - a pre-admission lead, not yet a formal Admission.
  AdmissionEnquiry: {
    create: [ACCOUNTS_MANAGER, ADMIN_OFFICER],
    read: [PRINCIPAL, ADMIN_OFFICER, ACCOUNTS_MANAGER],
    update: [ACCOUNTS_MANAGER, ADMIN_OFFICER],
    delete: [ACCOUNTS_MANAGER],
  },
  // "Sale of Application" page.
  Application: {
    create: [ACCOUNTS_MANAGER, ADMIN_OFFICER],
    read: [PRINCIPAL, ADMIN_OFFICER, ACCOUNTS_MANAGER],
    update: [ACCOUNTS_MANAGER, ADMIN_OFFICER],
    delete: [ACCOUNTS_MANAGER],
  },
  // Subject master data - the catalog behind every subject dropdown (see
  // models/Subject.js). Principal and Accounts Manager manage it; Admin
  // Officer and Teacher are read-only, since they consume the list (staff
  // forms, class assignments, marks, homework) but don't curate it.
  //
  // Unlike the other master-data entities here (FeeStructure/BusRoute,
  // which Admin Officer owns), this one is edited by SINGLE-branch roles
  // against a SHARED catalog - so subjectController.js additionally blocks
  // renaming or deleting a subject that another branch has enabled. That
  // guard is not expressible in this table, which is purely role-based.
  Subject: {
    create: [PRINCIPAL, ACCOUNTS_MANAGER],
    read: [PRINCIPAL, ADMIN_OFFICER, ACCOUNTS_MANAGER, TEACHER],
    update: [PRINCIPAL, ACCOUNTS_MANAGER],
    delete: [PRINCIPAL, ACCOUNTS_MANAGER],
  },
  Class: {
    create: [PRINCIPAL, ADMIN_OFFICER, ACCOUNTS_MANAGER],
    read: [PRINCIPAL, ADMIN_OFFICER, ACCOUNTS_MANAGER, TEACHER],
    update: [PRINCIPAL, ADMIN_OFFICER, TEACHER],
    delete: [PRINCIPAL],
  },
  // The official per-branch/class fee schedule (see Branch_Fee_Structure
  // import). Only Admin Officer manages it - same as Branches - but read
  // access is wider since Admission and StudentFeeReport forms both look
  // it up to lock their gross-fee fields.
  FeeStructure: {
    create: [ADMIN_OFFICER],
    read: [PRINCIPAL, ADMIN_OFFICER, ACCOUNTS_MANAGER],
    update: [ADMIN_OFFICER],
    delete: [ADMIN_OFFICER],
  },
  // Bus route master data - same shape as FeeStructure/Branches: only
  // Admin Officer manages it, wider read access since other roles may
  // need to look routes up (e.g. assigning a student to one) later.
  BusRoute: {
    create: [ADMIN_OFFICER],
    read: [PRINCIPAL, ADMIN_OFFICER, ACCOUNTS_MANAGER],
    update: [ADMIN_OFFICER],
    delete: [ADMIN_OFFICER],
  },
  Student: {
    create: [ACCOUNTS_MANAGER],
    read: [PRINCIPAL, ADMIN_OFFICER, TEACHER, ACCOUNTS_MANAGER, STUDENT],
    update: [ACCOUNTS_MANAGER],
    // Accounts Manager deliberately excluded: they can only *request* a
    // student deletion (POST /:id/request-delete, route-gated separately in
    // studentRoutes.js), never delete directly - an Admin Officer assigned
    // to that student's branch must approve it via POST /:id/approve-delete.
    // No role is listed here, so the plain DELETE /:id endpoint is
    // effectively super_admin-only.
    delete: [],
    studentOwnOnly: true,
  },
  Staff: {
    create: [PRINCIPAL, ADMIN_OFFICER],
    read: [PRINCIPAL, ADMIN_OFFICER, ACCOUNTS_MANAGER, TEACHER], // teacher sees staff directory, scoped to own branch
    update: [PRINCIPAL, ADMIN_OFFICER],
    delete: [PRINCIPAL],
  },
  Attendance: {
    create: [TEACHER, PRINCIPAL, ADMIN_OFFICER],
    read: [TEACHER, PRINCIPAL, ADMIN_OFFICER, ACCOUNTS_MANAGER, STUDENT],
    update: [TEACHER, PRINCIPAL, ADMIN_OFFICER],
    delete: [PRINCIPAL, ADMIN_OFFICER],
    studentOwnOnly: true,
  },
  Marks: {
    // Principal is read-only here - only Teachers enter marks (enforced in
    // marksController.js, which doesn't consult this table directly but
    // should stay in sync with it).
    create: [TEACHER],
    read: [TEACHER, PRINCIPAL, ADMIN_OFFICER, ACCOUNTS_MANAGER, STUDENT],
    update: [TEACHER, PRINCIPAL],
    delete: [TEACHER, PRINCIPAL],
    studentOwnOnly: true,
  },
  Exam: {
    create: [PRINCIPAL, ADMIN_OFFICER],
    read: [PRINCIPAL, ADMIN_OFFICER, TEACHER, STUDENT],
    update: [PRINCIPAL, ADMIN_OFFICER],
    delete: [PRINCIPAL, ADMIN_OFFICER],
  },
  Homework: {
    create: [TEACHER, PRINCIPAL],
    read: [TEACHER, PRINCIPAL, STUDENT],
    update: [TEACHER, PRINCIPAL],
    delete: [TEACHER, PRINCIPAL],
  },
  HomeworkNotification: {
    create: [TEACHER, PRINCIPAL], // usually system-generated, see homeworkController fanout
    read: [TEACHER, PRINCIPAL, STUDENT],
    update: [TEACHER, PRINCIPAL, STUDENT], // student updates status -> "Read"
    delete: [TEACHER, PRINCIPAL],
    studentOwnOnly: true,
  },
  FeePayment: {
    create: [ADMIN_OFFICER, ACCOUNTS_MANAGER],
    read: [ADMIN_OFFICER, ACCOUNTS_MANAGER, PRINCIPAL, STUDENT],
    update: [ADMIN_OFFICER, ACCOUNTS_MANAGER],
    // Admin Officer only - cancelling a receipt directly (cancelReceipt in
    // feeController.js) is no longer available to Accounts Manager or
    // Principal; they go through request-cancel-receipt ->
    // FeeReceiptCancellationRequest below instead, same reasoning as
    // Student.delete being empty here while its own request/approve flow
    // is separately route-gated.
    delete: [ADMIN_OFFICER],
    studentOwnOnly: true,
  },
  // Cancelling a fee receipt (a receipt_no, which may bundle several
  // FeePayment rows paid together) - requested by an Accounts Manager,
  // approved/rejected only by an Admin Officer assigned to that branch.
  FeeReceiptCancellationRequest: {
    create: [ACCOUNTS_MANAGER],
    read: [ADMIN_OFFICER, ACCOUNTS_MANAGER],
    update: [ADMIN_OFFICER],
  },
  // Permission to collect a fee payment dated in the past - requested by
  // whoever would otherwise collect the payment, approved/rejected only
  // by the Principal (that's the whole point of the gate).
  BackDateRequest: {
    create: [ADMIN_OFFICER, ACCOUNTS_MANAGER],
    read: [ADMIN_OFFICER, ACCOUNTS_MANAGER, PRINCIPAL],
    update: [PRINCIPAL],
  },
  StudentFeeReport: {
    create: [ADMIN_OFFICER, ACCOUNTS_MANAGER],
    read: [ADMIN_OFFICER, ACCOUNTS_MANAGER, PRINCIPAL],
    update: [ADMIN_OFFICER, ACCOUNTS_MANAGER],
    delete: [ADMIN_OFFICER, ACCOUNTS_MANAGER, PRINCIPAL],
  },
  // Permission to re-edit ONE concession bucket that's already locked
  // (see StudentFeeReport.concession_locked_buckets) - requested by an
  // Accounts Manager, approved/rejected only by an Admin Officer, who can
  // also edit any concession directly at any time (that's covered by
  // StudentFeeReport.update above, not this entity - Admin Officer is
  // never blocked by the lock in the first place).
  ConcessionChangeRequest: {
    create: [ACCOUNTS_MANAGER],
    read: [ADMIN_OFFICER, ACCOUNTS_MANAGER],
    update: [ADMIN_OFFICER],
  },
  // An Accounts Manager can no longer create a Student directly - they
  // submit this request (with a reason) instead, and an Admin Officer
  // assigned to the request's branch must approve it (see
  // isBranchAdminOfficer in studentController.js) before the Student
  // record actually gets created. No `update` array: approve/reject are
  // gated by that branch-scoped check inside the controller, not a plain
  // role check.
  StudentAdditionRequest: {
    create: [ACCOUNTS_MANAGER],
    read: [ACCOUNTS_MANAGER, ADMIN_OFFICER],
  },
  Income: {
    create: [ADMIN_OFFICER, ACCOUNTS_MANAGER],
    read: [ADMIN_OFFICER, ACCOUNTS_MANAGER, PRINCIPAL],
    update: [ADMIN_OFFICER, ACCOUNTS_MANAGER],
    delete: [ADMIN_OFFICER, ACCOUNTS_MANAGER, PRINCIPAL],
  },
  Expenditure: {
    create: [ADMIN_OFFICER, ACCOUNTS_MANAGER, PRINCIPAL],
    read: [ADMIN_OFFICER, ACCOUNTS_MANAGER, PRINCIPAL],
    update: [ADMIN_OFFICER, ACCOUNTS_MANAGER, PRINCIPAL],
    delete: [ADMIN_OFFICER, ACCOUNTS_MANAGER, PRINCIPAL],
  },
  Event: {
    create: [PRINCIPAL, ADMIN_OFFICER],
    read: [PRINCIPAL, ADMIN_OFFICER, TEACHER, ACCOUNTS_MANAGER, STUDENT],
    update: [PRINCIPAL, ADMIN_OFFICER],
    delete: [PRINCIPAL, ADMIN_OFFICER],
  },
  // Ideas staff work out with the AI assistant and submit to the
  // development team (see featureRequestController.js). Every staff role can
  // submit and track its own; update (status / reply) lists no roles, so it
  // is super_admin-only.
  FeatureRequest: {
    create: [PRINCIPAL, ADMIN_OFFICER, ACCOUNTS_MANAGER, TEACHER],
    read: [PRINCIPAL, ADMIN_OFFICER, ACCOUNTS_MANAGER, TEACHER],
    update: [],
  },
  Appointment: {
    create: [PRINCIPAL, ADMIN_OFFICER, TEACHER],
    read: [PRINCIPAL, ADMIN_OFFICER, TEACHER], // further scoped to creator/with_whom in controller
    update: [PRINCIPAL, ADMIN_OFFICER, TEACHER],
    delete: [PRINCIPAL, ADMIN_OFFICER],
    ownerScope: [TEACHER], // teacher can only touch appointments they created or are the subject of
  },
};

export function isAllowed(entityName, action, role) {
  if (role === SUPER_ADMIN) return true;
  const rule = PERMISSIONS[entityName];
  if (!rule || !rule[action]) return false;
  return rule[action].includes(role);
}

export function getPermissionRule(entityName) {
  return PERMISSIONS[entityName] || null;
}
