import axios from "axios";
import http from "./http";

// controllers/userController.js.
export const userApi = {
  async list(params = {}) {
    const { data } = await http.get("/api/users", { params });
    return data?.data ?? data;
  },

  /**
   * GET /api/users?summary=branch -> [{ branch, total, active }]
   *
   * Headcount per branch for the Staff page's branch cards. Deliberately
   * NOT list() + client-side grouping: a User document carries salary,
   * phone, address and email, and the cards only need a number - there is
   * no reason to ship every branch's payroll to the browser to render it.
   */
  async branchSummary(params = {}) {
    const { data } = await http.get("/api/users", {
      params: { ...params, summary: "branch", exclude_role: "student" },
    });
    return data?.data ?? data;
  },

  async create(body) {
    const { data } = await http.post("/api/users", body);
    return data?.data ?? data;
  },

  /** PUT /api/users/:id — omit `password` entirely to leave it unchanged. */
  async update(id, body) {
    const { data } = await http.put(`/api/users/${id}`, body);
    return data?.data ?? data;
  },

  async remove(id) {
    const { data } = await http.delete(`/api/users/${id}`);
    return data?.data ?? data;
  },

  /** POST /api/users/transfer-teachers — Admin Officer only.
   * body: { teacher_ids, destination_branch }
   * Resolves to { success, transferred: [...], blocked: [...] } - partial
   * success per teacher, not all-or-nothing. */
  async transferTeachers(body) {
    const { data } = await http.post("/api/users/transfer-teachers", body);
    return data;
  },

  /** POST /api/users/:id/request-delete — Accounts Manager only. Flags the
   * staff member for Principal approval instead of deactivating directly. */
  async requestDelete(id) {
    const { data } = await http.post(`/api/users/${id}/request-delete`);
    return data?.data ?? data;
  },

  /** POST /api/users/:id/withdraw-delete-request — Accounts Manager only,
   * and only the one who submitted the request. */
  async withdrawDeleteRequest(id) {
    const { data } = await http.post(
      `/api/users/${id}/withdraw-delete-request`,
    );
    return data?.data ?? data;
  },

  /** POST /api/users/:id/approve-delete — Principal only. Actually
   * deactivates the staff member and notifies the requester + branch
   * Admin Officer(s). */
  async approveDelete(id) {
    const { data } = await http.post(`/api/users/${id}/approve-delete`);
    return data?.data ?? data;
  },

  /** POST /api/users/:id/reject-delete — Principal only. Leaves the staff
   * member active and notifies the requester. */
  async rejectDelete(id) {
    const { data } = await http.post(`/api/users/${id}/reject-delete`);
    return data?.data ?? data;
  },
};

// notification api
export const notificationApi = {
  /** GET /api/notifications - pass { all: "1" } to include Resolved.
   * Kept returning the bare array (unwrapped) since the navbar bell (the
   * original/only caller) just wants a list - use listPaged() below for the
   * full NotificationsPage, which also needs the `meta` pagination block. */
  async list(params = {}) {
    const { data } = await http.get("/api/notifications", { params });
    return data?.data ?? data;
  },
  /** GET /api/notifications - params (all optional): { status: "Open" |
   * "Resolved" | "All", branch, page, limit }. Returns the full { data,
   * meta } envelope - when params includes `page`, `meta` carries
   * { total, page, limit, totalPages }, same shape as feeApi.listPayments. */
  async listPaged(params = {}) {
    const { data } = await http.get("/api/notifications", { params });
    return data;
  },
  /** PUT /api/notifications/:id/resolve */
  async resolve(id) {
    const { data } = await http.put(`/api/notifications/${id}/resolve`);
    return data?.data ?? data;
  },
};

// Requesting/approving/rejecting permission to collect a fee payment
// dated in the past - see backDateRequestController.js. An Approved
// request is single-use, consumed by feeController.js collectPayment()
// the moment it's actually used, not a standing permission.
export const backDateRequestApi = {
  /** POST /api/back-date-requests - body: { requested_date: "YYYY-MM-DD",
   * reason }. requested_date must be before today - today/future dates
   * never need approval. Resolves to { request, notification }. */
  async create(body) {
    const { data } = await http.post("/api/back-date-requests", body);
    return data?.data ?? data;
  },
  /** GET /api/back-date-requests/available - this user's Approved-and-
   * unused requests, so the Add Fee Payment form knows which specific
   * past date(s), if any, it can let them pick right now. */
  async listAvailable() {
    const { data } = await http.get("/api/back-date-requests/available");
    return data?.data ?? data;
  },
  /** PUT /api/back-date-requests/:id/approve - Principal only. */
  async approve(id) {
    const { data } = await http.put(`/api/back-date-requests/${id}/approve`);
    return data?.data ?? data;
  },
  /** PUT /api/back-date-requests/:id/reject - Principal only. */
  async reject(id) {
    const { data } = await http.put(`/api/back-date-requests/${id}/reject`);
    return data?.data ?? data;
  },
};

//student api
export const studentApi = {
  /** GET /api/students — branch/teacher scoping handled server-side */
  async list(params = {}) {
    const { data } = await http.get("/api/students", { params });
    return data.data ?? data;
  },

  /** GET /api/students - same endpoint as list() above, but returns the
   * full envelope instead of unwrapping it: { data, total, page, limit,
   * totalPages }. Used by BPStudents.jsx, whose table is paginated/searched
   * server-side (params: { search, class, academic_year, gender,
   * student_type, branch, status_tab, sort, page, limit }) rather than
   * fetching every student and filtering in the browser.
   *
   * `student_type` ("New" | "Existing") is the Old/New filter - it is not a
   * field on Student, so the server resolves it through the student's
   * StudentFeeReport; a student with no fee report matches neither value. */
  async listPaged(params = {}) {
    const { data } = await http.get("/api/students", { params });
    return data;
  },

  /**
   * GET /api/students/export - every student matching the same filters
   * listPaged understands ({ class, section, academic_year, gender,
   * student_type, branch, status_tab, search }), in ONE unpaginated
   * response, projected down to
   * just the columns the export sheet prints. `class` and `branch` come
   * back populated, so the sheet does not depend on the page having loaded
   * a matching class list. Resolves to { data, total }.
   */
  async exportList(params = {}) {
    const { data } = await http.get("/api/students/export", { params });
    return data;
  },

  /** GET /api/students/:id */
  async getById(id) {
    const { data } = await http.get(`/api/students/${id}`);
    return data;
  },

  /** POST /api/students */
  async create(body) {
    const { data } = await http.post("/api/students", body);
    return data;
  },

  /** POST /api/students/bulk */
  async bulkCreate(records) {
    const { data } = await http.post("/api/students/bulk", records);
    return data;
  },

  /** PUT /api/students/:id */
  async update(id, body) {
    const { data } = await http.put(`/api/students/${id}`, body);
    return data;
  },

  /** POST /api/students/promote — body: { student_ids, class } */
  async promote(body) {
    const { data } = await http.post("/api/students/promote", body);
    return data;
  },

  /** DELETE /api/students/:id — direct soft delete. No role currently holds
   * Student.delete except super_admin; Accounts Manager must go through
   * requestDelete/withdrawDeleteRequest below instead. */
  async remove(id) {
    const { data } = await http.delete(`/api/students/${id}`);
    return data;
  },

  /** POST /api/students/:id/request-delete — Accounts Manager only. Flags
   * the student for Admin Officer approval instead of deleting directly.
   * isDropout bypasses the outstanding-fee-balance guard - the balance is
   * waived at approval time instead of being collected (see
   * approveDeleteRequestStudent on the backend). */
  async requestDelete(id, isDropout = false) {
    const { data } = await http.post(`/api/students/${id}/request-delete`, {
      isDropout,
    });
    return data?.data ?? data;
  },

  /** POST /api/students/:id/withdraw-delete-request — Accounts Manager
   * only, and only the one who submitted the request. */
  async withdrawDeleteRequest(id) {
    const { data } = await http.post(
      `/api/students/${id}/withdraw-delete-request`,
    );
    return data?.data ?? data;
  },

  /** POST /api/students/:id/approve-delete — Principal only. Actually
   * deletes the student and notifies the requester. */
  async approveDelete(id) {
    const { data } = await http.post(`/api/students/${id}/approve-delete`);
    return data?.data ?? data;
  },

  /** POST /api/students/:id/reject-delete — Principal only. Leaves the
   * student in place and notifies the requester. */
  async rejectDelete(id) {
    const { data } = await http.post(`/api/students/${id}/reject-delete`);
    return data?.data ?? data;
  },

  /** POST /api/students/:id/request-status-change — Accounts Manager only.
   * body: { status }. Flags the student for Principal approval instead of
   * changing status directly (PUT /api/students/:id now strips `status`
   * out of the body entirely). */
  async requestStatusChange(id, status) {
    const { data } = await http.post(
      `/api/students/${id}/request-status-change`,
      { status },
    );
    return data?.data ?? data;
  },

  /** POST /api/students/:id/withdraw-status-change-request — Accounts
   * Manager only, and only the one who submitted the request. */
  async withdrawStatusChangeRequest(id) {
    const { data } = await http.post(
      `/api/students/${id}/withdraw-status-change-request`,
    );
    return data?.data ?? data;
  },

  /** POST /api/students/:id/approve-status-change — Principal only.
   * Actually flips the student's status and notifies the requester. */
  async approveStatusChange(id) {
    const { data } = await http.post(
      `/api/students/${id}/approve-status-change`,
    );
    return data?.data ?? data;
  },

  /** POST /api/students/:id/reject-status-change — Principal only. Leaves
   * the status unchanged and notifies the requester. */
  async rejectStatusChange(id) {
    const { data } = await http.post(
      `/api/students/${id}/reject-status-change`,
    );
    return data?.data ?? data;
  },

  /** POST /api/students/addition-requests — Accounts Manager only. body:
   * { reason, ...same fields as create()'s body }. Submits a request
   * instead of creating the student directly - an Admin Officer assigned
   * to the branch must approve it first (see approveAdditionRequestStudent
   * on the backend, which also creates the matching StudentFeeReport). */
  async requestAddition(body) {
    const { data } = await http.post("/api/students/addition-requests", body);
    return data?.data ?? data;
  },

  /** GET /api/students/addition-requests?status=Pending — an Accounts
   * Manager only sees their own requests; an Admin Officer sees every
   * pending request across the branches assigned to them. */
  async listAdditionRequests(params = {}) {
    const { data } = await http.get("/api/students/addition-requests", {
      params,
    });
    return data?.data ?? data;
  },

  /** PUT /api/students/addition-requests/:id/approve — Admin Officer
   * only, assigned branches only. Creates the Student + StudentFeeReport. */
  async approveAddition(id) {
    const { data } = await http.put(
      `/api/students/addition-requests/${id}/approve`,
    );
    return data?.data ?? data;
  },

  /** PUT /api/students/addition-requests/:id/reject — Admin Officer only,
   * assigned branches only. body: { rejection_reason } */
  async rejectAddition(id, rejection_reason) {
    const { data } = await http.put(
      `/api/students/addition-requests/${id}/reject`,
      { rejection_reason },
    );
    return data?.data ?? data;
  },

  /** PUT /api/students/addition-requests/:id/withdraw — the Accounts
   * Manager who submitted it, only while still Pending. */
  async withdrawAdditionRequest(id) {
    const { data } = await http.put(
      `/api/students/addition-requests/${id}/withdraw`,
    );
    return data?.data ?? data;
  },
};

/** POST /api/transfers - the Transfers page's one endpoint for all 6
 * transfer types. body: { type, student_id, ...type-specific fields }:
 *   class          - { class_id }
 *   transport_on   - { route, amount }
 *   route          - { route, amount? }
 *   hostel_on      - { amount }
 *   hostel_off     - {}
 *   transport_off  - {}
 * Resolves to { student, report } with the post-transfer state, so the
 * page can refresh its "Current status" panel straight off the response. */
export const transferApi = {
  async transfer(body) {
    const { data } = await http.post("/api/transfers", body);
    return data?.data ?? data;
  },
};

export const classApi = {
  async list(params = {}) {
    const { data } = await http.get("/api/classes", { params });
    return data;
  },

  async listWithMeta(params = {}) {
    const { data } = await http.get("/api/classes", { params });
    return data?.data ?? data;
  },
  async create(body) {
    const { data } = await http.post("/api/classes", body);
    return data;
  },
  async update(id, body) {
    const { data } = await http.put(`/api/classes/${id}`, body);
    return data;
  },
  async remove(id) {
    const { data } = await http.delete(`/api/classes/${id}`);
    return data;
  },
  async assignSubjectTeacher(classId, { teacher_id, subject }) {
    const { data } = await http.put(
      `/api/classes/${classId}/subject-teachers`,
      { teacher_id, subject },
    );
    return data;
  },
  async removeSubjectTeacher(classId, { teacher_id, subject }) {
    // axios requires body on DELETE to go under `data`
    const { data } = await http.delete(
      `/api/classes/${classId}/subject-teachers`,
      {
        data: { teacher_id, subject },
      },
    );
    return data;
  },
};

// attendance api
export const attendanceApi = {
  /**
   * GET /api/attendance — role-aware scoping handled server-side.
   *
   * Two usage shapes:
   *  - Daily marking view: { date, subject, class_id } — teacher must be
   *    assigned to that exact (class_id, subject), enforced server-side.
   *  - Monthly / analytics view: no params (or just { class_id }) — for a
   *    teacher this returns only classes where they are the Class Teacher.
   */
  async list(params = {}) {
    const { data } = await http.get("/api/attendance", { params });
    return data.data ?? data;
  },

  /**
   * POST /api/attendance/bulk-mark — upserts an entire class/subject/date
   * roll call in one call instead of one create-or-update per student.
   * body: { class_id, subject, date, records: [{ student_id, student_name, status }] }
   */
  async bulkMark(body) {
    const { data } = await http.post("/api/attendance/bulk-mark", body);
    return data.data ?? data;
  },

  /** POST /api/attendance — single record create (kept for other callers) */
  async create(body) {
    const { data } = await http.post("/api/attendance", body);
    return data.data ?? data;
  },

  /** PUT /api/attendance/:id */
  async update(id, body) {
    const { data } = await http.put(`/api/attendance/${id}`, body);
    return data.data ?? data;
  },
};

// marks api
export const marksApi = {
  /**
   * GET /api/marks — role-aware scoping handled server-side.
   * A teacher only ever receives:
   *   (a) every subject for classes where they are the Class Teacher, and
   *   (b) their own subject's marks for classes they teach but aren't
   *       Class Teacher of.
   * params (all optional): { class_id, exam_type, subject, student_id }
   */
  async list(params = {}) {
    const { data } = await http.get("/api/marks", { params });
    return data.data ?? data;
  },

  /**
   * POST /api/marks — server validates (class_id, subject) against the
   * teacher's subject_assignments before allowing the write.
   */
  async create(body) {
    const { data } = await http.post("/api/marks", body);
    return data.data ?? data;
  },

  /** PUT /api/marks/:id */
  async update(id, body) {
    const { data } = await http.put(`/api/marks/${id}`, body);
    return data.data ?? data;
  },
};

export const admissionApi = {
  /** GET /api/admissions - params (all optional): { form_status, sort, limit } */
  async list(params = {}) {
    const { data } = await http.get("/api/admissions", { params });
    return data?.data ?? data;
  },

  /** POST /api/admissions - unique_id/application_no are generated
   * server-side; branch defaults to the caller's own branch if omitted. */
  async create(body) {
    const { data } = await http.post("/api/admissions", body);
    return data?.data ?? data;
  },

  /** PUT /api/admissions/:id */
  async update(id, body) {
    const { data } = await http.put(`/api/admissions/${id}`, body);
    return data?.data ?? data;
  },

  /** DELETE /api/admissions/:id - only Enquiry/Rejected applications */
  async remove(id) {
    const { data } = await http.delete(`/api/admissions/${id}`);
    return data?.data ?? data;
  },

  /** POST /api/admissions/:id/admit - generates admission_no, resolves
   * class_sought to a real Class, generates roll_no, creates the linked
   * Student record, creates its StudentFeeReport (pre-filled from the
   * admission's fee figures), and - if `body.rows` is given - records that
   * payment as real FeePayment documents against the new student, all in
   * one call. body (all optional - omit entirely to admit with nothing
   * collected yet): { rows: [{key: 'admission_fee'|'registration_fee'|
   * 'term_fee', amount}], payment_date, voucher_type, voucher_no?,
   * payment_mode, cheque_date?, transaction_no?, bank_name?, bank_branch? }.
   * voucher_no is only used for voucher_type 'MvNo' (typed in by hand) -
   * for 'CvNo' the server always generates it itself, ignoring anything
   * sent here. Each row is capped server-side at that bucket's actual
   * remaining balance. Resolves to { admission, student, report, payments }. */
  async admit(id, body = {}) {
    const { data } = await http.post(`/api/admissions/${id}/admit`, body);
    return data?.data ?? data;
  },

  /** POST /api/admissions/:id/convert - fallback for an already-Admitted
   * record with no linked student yet; idempotent. */
  async convert(id) {
    const { data } = await http.post(`/api/admissions/${id}/convert`);
    return data?.data ?? data;
  },
};
export const branchApi = {
  /** GET /api/branches */
  async list(params = {}) {
    const { data } = await http.get("/api/branches", { params });
    return data?.data ?? data;
  },

  /** POST /api/branches — Admin Officer only */
  async create(body) {
    const { data } = await http.post("/api/branches", body);
    return data?.data ?? data;
  },

  /** PUT /api/branches/:id — Admin Officer only */
  async update(id, body) {
    const { data } = await http.put(`/api/branches/${id}`, body);
    return data?.data ?? data;
  },

  /** DELETE /api/branches/:id — Admin Officer only; soft-deletes (is_active: false) */
  async remove(id) {
    const { data } = await http.delete(`/api/branches/${id}`);
    return data?.data ?? data;
  },
};
export const schoolApi = {
  /** GET /api/schools - pass { activeOnly: true } to hide deactivated schools */
  async list(params = {}) {
    const { data } = await http.get("/api/schools", { params });
    return data?.data ?? data;
  },

  /** POST /api/schools — Super Admin only */
  async create(body) {
    const { data } = await http.post("/api/schools", body);
    return data?.data ?? data;
  },

  /** PUT /api/schools/:id — Super Admin only */
  async update(id, body) {
    const { data } = await http.put(`/api/schools/${id}`, body);
    return data?.data ?? data;
  },

  /** DELETE /api/schools/:id — Super Admin only; soft-deletes (is_active: false) */
  async remove(id) {
    const { data } = await http.delete(`/api/schools/${id}`);
    return data?.data ?? data;
  },
};
export const feeStructureApi = {
  /** GET /api/fee-structures - params (all optional): { branch, academic_year, grade } */
  async list(params = {}) {
    const { data } = await http.get("/api/fee-structures", { params });
    return data?.data ?? data;
  },

  /**
   * GET /api/fee-structures?summary=branch -> [{ branch, grades }]
   * `grades` is the count of DISTINCT classes configured for the given
   * academic_year, which is what the branch card reports as "12 of 14".
   */
  async branchSummary(params = {}) {
    const { data } = await http.get("/api/fee-structures", {
      params: { ...params, summary: "branch" },
    });
    return data?.data ?? data;
  },

  /** POST /api/fee-structures — Admin Officer only */
  async create(body) {
    const { data } = await http.post("/api/fee-structures", body);
    return data?.data ?? data;
  },

  /** PUT /api/fee-structures/:id — Admin Officer only */
  async update(id, body) {
    const { data } = await http.put(`/api/fee-structures/${id}`, body);
    return data?.data ?? data;
  },

  /** DELETE /api/fee-structures/:id — Admin Officer only; soft-deletes */
  async remove(id) {
    const { data } = await http.delete(`/api/fee-structures/${id}`);
    return data?.data ?? data;
  },
};

// Bus route master data (branch, route name, from/to, in-between stops,
// one flat fee per route) - Admin Officer only for create/update/delete,
// wider read access.
export const busRouteApi = {
  /** GET /api/bus-routes - params (optional): { branch } */
  async list(params = {}) {
    const { data } = await http.get("/api/bus-routes", { params });
    return data?.data ?? data;
  },

  /** GET /api/bus-routes?summary=branch -> [{ branch, total, fee_total }] */
  async branchSummary(params = {}) {
    const { data } = await http.get("/api/bus-routes", {
      params: { ...params, summary: "branch" },
    });
    return data?.data ?? data;
  },
  /** POST /api/bus-routes — Admin Officer only */
  async create(body) {
    const { data } = await http.post("/api/bus-routes", body);
    return data?.data ?? data;
  },
  /** PUT /api/bus-routes/:id — Admin Officer only */
  async update(id, body) {
    const { data } = await http.put(`/api/bus-routes/${id}`, body);
    return data?.data ?? data;
  },
  /** DELETE /api/bus-routes/:id — Admin Officer only; soft-deletes */
  async remove(id) {
    const { data } = await http.delete(`/api/bus-routes/${id}`);
    return data?.data ?? data;
  },
};

// Subject master data - the catalog behind every subject dropdown in the
// app, replacing the hard-coded lists that used to live in lib/constants.js
// and in half a dozen individual pages. Managed by Principal and Accounts
// Manager; everyone else reads it.
//
// A subject is in the catalog once for the whole school, and separately
// enabled per branch - so list() (branch-scoped) is what dropdowns want,
// and catalog() is only for the management page.
export const subjectApi = {
  /**
   * GET /api/subjects - subjects enabled for the caller's branch, sorted by
   * name. This is what every subject dropdown should use: it already
   * excludes inactive subjects and anything the branch has not adopted.
   * params (optional): { branch } for multi-branch roles.
   */
  async list(params = {}) {
    const { data } = await http.get("/api/subjects", { params });
    return data?.data ?? data;
  },

  /**
   * GET /api/subjects?scope=catalog - the whole catalog regardless of
   * branch, with `branches` populated to { _id, name, code }. Only the
   * Subjects management page needs this; a dropdown that used it would
   * offer subjects the branch has not adopted.
   */
  async catalog(params = {}) {
    const { data } = await http.get("/api/subjects", {
      params: { ...params, scope: "catalog", include_inactive: true },
    });
    return data?.data ?? data;
  },

  /** POST /api/subjects - body { name, code? }. Also enables it for the
   *  creator's own branch. Principal / Accounts Manager only. */
  async create(body) {
    const { data } = await http.post("/api/subjects", body);
    return data?.data ?? data;
  },

  /** PUT /api/subjects/:id - body { name?, code?, is_active? }. Renaming or
   *  deactivating is refused with a 409 when another branch has the subject
   *  enabled. `branches` is not settable here - use setBranch(). */
  async update(id, body) {
    const { data } = await http.put(`/api/subjects/${id}`, body);
    return data?.data ?? data;
  },

  /** PUT /api/subjects/:id/branch - body { enabled, branch? }. Adds the
   *  subject to a branch or removes it. Single-branch roles may only ever
   *  affect their own branch, so `branch` can be omitted. */
  async setBranch(id, enabled, branch) {
    const { data } = await http.put(`/api/subjects/${id}/branch`, {
      enabled,
      ...(branch ? { branch } : {}),
    });
    return data?.data ?? data;
  },

  /** DELETE /api/subjects/:id - soft delete. Refused with a 409 when the
   *  subject is still referenced by a class assignment, staff record,
   *  marks, attendance or homework. */
  async remove(id) {
    const { data } = await http.delete(`/api/subjects/${id}`);
    return data?.data ?? data;
  },
};

export const analyticsApi = {
  async overview(params = {}) {
    const { data } = await http.get("/api/analytics/overview", { params });
    return data;
  },
  async feesSummary(params = {}) {
    const { data } = await http.get("/api/analytics/fees-summary", { params });
    return data;
  },
  async attendanceSummary(params = {}) {
    const { data } = await http.get("/api/analytics/attendance-summary", {
      params,
    });
    return data;
  },
  async academicPerformance(params = {}) {
    const { data } = await http.get("/api/analytics/academic-performance", {
      params,
    });
    return data;
  },
  async incomeExpenditure(params = {}) {
    const { data } = await http.get("/api/analytics/income-expenditure", {
      params,
    });
    return data;
  },
  async admissionsFunnel(params = {}) {
    const { data } = await http.get("/api/analytics/admissions-funnel", {
      params,
    });
    return data;
  },
  /** Accounts Manager only */
  async branchComparison(params = {}) {
    const { data } = await http.get("/api/analytics/branch-comparison", {
      params,
    });
    return data;
  },
  /** Admin dashboard stats - combined + per-branch enrollment, fees, income, expenditure */
  async dashboardStats(params = {}) {
    const { data } = await http.get("/api/analytics/dashboard-stats", {
      params,
    });
    return data.data; // Response structure: { success: true, data: { ... } }
  },
};

export const uploadApi = {
  /**
   * @param {File} file
   * @param {"students"|"staff"|"documents"} [category="documents"]
   * @returns {{ url: string }}
   */
  async uploadFile(file, category = "documents") {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await http.post(`/api/upload/${category}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },
};

export const ticketApi = {
  /**
   * @param {{ type: "bug"|"feature"|"improvement", page: string, description: string, image?: File }} ticket
   */
  async create({ type, page, description, image }) {
    const formData = new FormData();
    formData.append("type", type);
    formData.append("page", page);
    formData.append("description", description);
    if (image) formData.append("image", image);
    const { data } = await http.post("/api/tickets", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data?.data ?? data;
  },

  /**
   * GET /api/tickets/mine?page=&limit= — tickets raised by the logged-in
   * user, newest first. Returns { data, meta: { total, page, limit, totalPages } }.
   */
  async listMine({ page = 1, limit = 10 } = {}) {
    const { data } = await http.get("/api/tickets/mine", {
      params: { page, limit },
    });
    return { data: data?.data ?? [], meta: data?.meta };
  },
};

// homework api
export const homeworkApi = {
  /**
   * GET /api/homework — role-aware scoping handled server-side. A
   * teacher only ever receives homework for classes they teach.
   * params (all optional): { class_id, status, sort, limit }
   */
  async list(params = {}) {
    const { data } = await http.get("/api/homework", { params });
    return data?.data ?? data;
  },

  /**
   * POST /api/homework — server validates (class, subject) against the
   * teacher's Class.subject_teachers assignments, and sets `assigned_by`
   * to the logged-in user automatically (it's a User reference now, not
   * free text - don't send it from the client).
   */
  async create(body) {
    const { data } = await http.post("/api/homework", body);
    return data?.data ?? data;
  },

  /** DELETE /api/homework/:id */
  async remove(id) {
    const { data } = await http.delete(`/api/homework/${id}`);
    return data?.data ?? data;
  },

  /**
   * POST /api/homework/:id/notify — creates a notification for every
   * active student in the homework's class, server-side, in one call.
   * Resolves to { notified: <count> }.
   */
  async notify(id) {
    const { data } = await http.post(`/api/homework/${id}/notify`);
    return data?.data ?? data;
  },
};

// controllers/examScheduleController.js — backs Hall Ticket generation.
export const examScheduleApi = {
  /**
   * GET /api/exam-schedules — branch-scoped server-side; every role can
   * read (teacher/principal/accounts_manager). params (all optional):
   * { class, academic_year, sort, limit }
   */
  async list(params = {}) {
    const { data } = await http.get("/api/exam-schedules", { params });
    return data?.data ?? data;
  },

  /**
   * POST /api/exam-schedules — server enforces the caller is the Class
   * Teacher (Class.class_teacher_id) of `body.class`, and rejects any
   * subject whose date/time overlaps another subject already scheduled
   * for that class (400, with a message naming the conflict).
   * body: { exam_name, class, section?, academic_year, exam_type, center?,
   * invigilator?, subjects: [{ subject, date, start_time, duration_minutes, max_marks }] }
   */
  async create(body) {
    const { data } = await http.post("/api/exam-schedules", body);
    return data?.data ?? data;
  },

  /** PUT /api/exam-schedules/:id — same Class Teacher + overlap checks as create(). */
  async update(id, body) {
    const { data } = await http.put(`/api/exam-schedules/${id}`, body);
    return data?.data ?? data;
  },

  /** DELETE /api/exam-schedules/:id — Class Teacher of that class only. */
  async remove(id) {
    const { data } = await http.delete(`/api/exam-schedules/${id}`);
    return data?.data ?? data;
  },
};

export const feeApi = {
  // Payments
  /**
   * GET /api/fee-payments - params (all optional): { student_id,
   * academic_year, status, sort, search, from, to, branch, class,
   * payment_mode, fee_type, page, limit }. `class` filters by resolving to
   * that class's students server-side (FeePayment has no `class` field of
   * its own). Returns the full { data, meta } envelope (not unwrapped) -
   * when params includes `page`, `meta` carries
   * { total, page, limit, totalPages }.
   */
  async listPayments(params = {}) {
    const { data } = await http.get("/api/fee/listPayments", {
      params,
    });
    return data;
  },
  /** GET /api/fee/payments-summary - same filters as listPayments (minus
   * page/limit). Resolves to { count, total_collected }. */
  async paymentsSummary(params = {}) {
    const { data } = await http.get("/api/fee/payments-summary", {
      params,
    });
    return data?.data ?? data;
  },
  /** GET /api/fee-payments/pending-summary - params: { academic_year }
   * Resolves to { total_collected, total_pending, pending: [...] }. */
  async pendingSummary(params = {}) {
    const { data } = await http.get("/api/fee/pending-summary", {
      params,
    });
    return data?.data ?? data;
  },
  /** POST /api/fee-payments/collect - the actual "Insert" action: pass
   * one or more selected fee-particulars rows (school_fee/admission_fee/
   * previous_due, each with its own amount), one shared receipt is
   * generated, and the linked StudentFeeReport's balances update in the
   * same call. Resolves to { payments: [...], report }. */
  async collectPayment(body) {
    const { data } = await http.post("/api/fee/collectpayment", body);
    return data?.data ?? data;
  },
  /** POST /api/fee-payments - single ad-hoc record, not tied to a fee
   * report row. Prefer collectPayment() for the Fee Payments page. */
  async createPayment(body) {
    const { data } = await http.post("/api/fee/createpayment", body);
    return data?.data ?? data;
  },
  /** PUT /api/fee-payments/:id - also used to cancel a voucher via { status: "Cancelled" } */
  async updatePayment(id, body) {
    const { data } = await http.put(`/api/fee/updatePayment/${id}`, body);
    return data?.data ?? data;
  },
  async removePayment(id) {
    const { data } = await http.delete(`/api/fee/removePayment/${id}`);
    return data?.data ?? data;
  },
  /** POST /api/fee/cancelReceipt - body: { receipt_no }. Reverses every
   * FeePayment under that receipt back into the student's StudentFeeReport
   * balance and flips their status to "Cancelled". */
  async cancelReceipt(body) {
    const { data } = await http.post("/api/fee/cancelReceipt", body);
    return data?.data ?? data;
  },

  // Fee reports (structure)
  /**
   * GET /api/fee - params (all optional): { student_id, class, status,
   * student_type, has_old_fee, has_balance, search, from, to, sort, branch,
   * page, limit }. `from`/`to` filter on the report's created_date.
   * Returns the full { data, meta } envelope (not unwrapped) -
   * when params includes `page`, `meta` carries { total, page, limit,
   * totalPages }.
   */
  async listReports(params = {}) {
    const { data } = await http.get("/api/fee", { params });
    return data;
  },
  /** GET /api/fee/report-summary - same filters as listReports (minus
   * page/limit/sort). Resolves to { count, net_fee, paid_fee, balance_fee }. */
  async reportSummary(params = {}) {
    const { data } = await http.get("/api/fee/report-summary", { params });
    return data?.data ?? data;
  },
  /**
   * GET /api/fee/category-report - one of the 10 focused fee reports (see
   * src/lib/feeReportCategories.js). params: { category, class, search,
   * branch, sort, page, limit } - category is required, one of
   * "old"|"admission"|"term"|"transport"|"hostel"|"application"|
   * "registration"|"kit"|"other_income"|"inactive".
   * Returns the full { data, meta } envelope; every category returns rows
   * in the same shape ({ admission_no, student_name, gross, concession,
   * net, paid, balance, ... }).
   */
  async listCategoryReport(params = {}) {
    const { data } = await http.get("/api/fee/category-report", { params });
    return data;
  },
  /** GET /api/fee/category-report-summary - same params as
   * listCategoryReport (minus page/limit/sort). Resolves to
   * { count, net, paid, balance }. */
  async categoryReportSummary(params = {}) {
    const { data } = await http.get("/api/fee/category-report-summary", { params });
    return data?.data ?? data;
  },
  /**
   * GET /api/fee/class-consolidated-report - one row per SECTION for a given
   * academic year (includes sections with zero students that year). params:
   * { branch?, academic_year }. Resolves to
   * { summary: { total_classes, total_sections, net_fee, paid_fee,
   * balance_fee }, rows: [...] }. Each row carries { section, has_sections }:
   * has_sections false (with section null) means the class has no sections
   * defined at all and the row covers the whole class; a section of
   * "Not Assigned" means students of a sectioned class who aren't in one.
   */
  async classConsolidatedReport(params = {}) {
    const { data } = await http.get("/api/fee/class-consolidated-report", {
      params,
    });
    return data?.data ?? data;
  },
  /**
   * GET /api/fee/pending-report - the student-wise Pending Dues Report: one
   * row per student who still owes something, across EVERY fee bucket plus
   * old_fee (not just term fee, which is all the has_balance filter on
   * listReports covers). params (all optional): { branch, class, section,
   * student_type, search, min_pending, sort, page, limit } - sort defaults
   * to "-total_pending" (largest dues first). Omit `page` to get every
   * matching row in one request, which is what the Excel export needs.
   * Returns the full { data, meta } envelope.
   */
  async listPendingReport(params = {}) {
    const { data } = await http.get("/api/fee/pending-report", { params });
    return data;
  },
  /** GET /api/fee/pending-report-summary - same params as listPendingReport
   * (minus page/limit/sort). Resolves to
   * { count, net, paid, old_fee, total_pending }. */
  async pendingReportSummary(params = {}) {
    const { data } = await http.get("/api/fee/pending-report-summary", {
      params,
    });
    return data?.data ?? data;
  },
  /**
   * GET /api/fee/pending - paginated, flattened pending-fee rows (one row
   * per outstanding bucket/"Previous Due"). params (all optional): { class,
   * search, branch, page, limit }. Returns the full { data, meta } envelope -
   * meta carries { total, totalAmount, page, limit, totalPages }.
   */
  async listPending(params = {}) {
    const { data } = await http.get("/api/fee/pending", { params });
    return data;
  },

  /** GET /api/fee/eligible-students - params: { class, search?, search_by?,
   * branch? }. `search_by` picks the field ("name" default | "roll_no" |
   * "admission_no") - "name" does a case-insensitive "starts with" match,
   * scoped to the given class, capped at 15 results server-side (see
   * feeController.js listEligibleStudents) when search is used, so this is
   * meant to be called per keystroke; "roll_no"/"admission_no" are exact
   * (case-insensitive) matches instead. `signal` is optional (an
   * AbortController signal) so a caller doing search-as-you-type can
   * cancel a stale in-flight request when a newer keystroke supersedes it. */
  listEligibleStudents: async (params, signal) => {
    const { data } = await http.get("/api/fee/eligible-students", {
      params,
      signal,
    });
    return data.data;
  },

  /** GET /api/fee/item-payments?student_id=&fee_type=Kit%20Fee|Other -
   * Kit Fee/Other Income's running per-item history (e.g. "Text Books"),
   * reconstructed from the FeePayment ledger. Resolves to
   * { [item_name]: { total, actual, concession } }, where `total` is Fee
   * Paid Till Date and `actual`/`concession` are the item's cumulative
   * committed Actual Fee/Concession so far (see AddPaymentDialog.jsx,
   * which pre-fills its editable Actual/Concession inputs from these and
   * sends only the delta on save). */
  async itemPaymentTotals(params) {
    const { data } = await http.get("/api/fee/item-payments", { params });
    return data?.data ?? {};
  },

  async createReport(body) {
    const { data } = await http.post("/api/fee", body);
    return data?.data ?? data;
  },

  async updateReport(id, body) {
    const { data } = await http.put(`/api/fee/${id}`, body);
    return data?.data ?? data;
  },

  async removeReport(id) {
    const { data } = await http.delete(`/api/fee/${id}`);
    return data?.data ?? data;
  },
};

// Requesting/approving/rejecting permission to re-edit a locked concession
// bucket - see concessionController.js. Approving just reopens that bucket
// (removes it from the report's concession_locked_buckets) for the
// original requester to edit themselves via feeApi.updateReport - it
// doesn't apply a value on their behalf.
export const concessionApi = {
  /** GET /api/concession-change-requests - params (all optional):
   * { status: "Pending"|"Approved"|"Rejected", branch }. */
  async list(params = {}) {
    const { data } = await http.get("/api/concession-change-requests", {
      params,
    });
    return data?.data ?? data;
  },
  /** POST /api/concession-change-requests - body: { student_fee_report_id,
   * bucket: "adm"|"term"|"transport"|"hostel"|"application"|"registration",
   * reason }. Accounts Manager only, and only for a bucket that's actually
   * locked. */
  async create(body) {
    const { data } = await http.post("/api/concession-change-requests", body);
    return data?.data ?? data;
  },
  /** PUT /api/concession-change-requests/:id/approve - Admin Officer only. */
  async approve(id) {
    const { data } = await http.put(
      `/api/concession-change-requests/${id}/approve`,
    );
    return data?.data ?? data;
  },
  /** PUT /api/concession-change-requests/:id/reject - Admin Officer only. */
  async reject(id) {
    const { data } = await http.put(
      `/api/concession-change-requests/${id}/reject`,
    );
    return data?.data ?? data;
  },
};

// Requesting/approving/rejecting a fee receipt cancellation - see
// feeController.js's requestCancelReceipt/approveCancelReceiptRequest/
// rejectCancelReceiptRequest. A receipt_no can bundle several FeePayment
// rows paid together (e.g. Admission Fee + Term Fee in one transaction) -
// one request always covers the whole receipt, never a single row within
// it, matching feeApi.cancelReceipt's own granularity.
export const feeReceiptCancellationApi = {
  /** GET /api/fee-receipt-cancellation-requests - params (optional):
   * { status: "Pending"|"Approved"|"Rejected", branch }. */
  async list(params = {}) {
    const { data } = await http.get(
      "/api/fee-receipt-cancellation-requests",
      { params },
    );
    return data?.data ?? data;
  },
  /** POST /api/fee-receipt-cancellation-requests - body: { receipt_no,
   * reason }. Accounts Manager only. */
  async create(body) {
    const { data } = await http.post(
      "/api/fee-receipt-cancellation-requests",
      body,
    );
    return data?.data ?? data;
  },
  /** PUT /api/fee-receipt-cancellation-requests/:id/approve - Admin
   * Officer only. Actually cancels the receipt (reverses it out of the
   * student's fee report and total collected) and notifies the requester. */
  async approve(id) {
    const { data } = await http.put(
      `/api/fee-receipt-cancellation-requests/${id}/approve`,
    );
    return data?.data ?? data;
  },
  /** PUT /api/fee-receipt-cancellation-requests/:id/reject - Admin
   * Officer only. Leaves the receipt as-is and notifies the requester. */
  async reject(id) {
    const { data } = await http.put(
      `/api/fee-receipt-cancellation-requests/${id}/reject`,
    );
    return data?.data ?? data;
  },
};

export const incomeApi = {
  /**
   * Returns the full { data, meta } envelope (not unwrapped) - when params
   * includes `page`, `meta` carries { total, page, limit, totalPages } for
   * pagination; without it, meta is undefined and data is the full match set.
   */
  async list(params = {}) {
    const { data } = await http.get("/api/income", { params });
    return data;
  },
  async create(body) {
    const { data } = await http.post("/api/income", body);
    return data?.data ?? data;
  },
  /** Saved records only allow editing payment_method - every other field is locked server-side. */
  async update(id, body) {
    const { data } = await http.put(`/api/income/${id}`, body);
    return data?.data ?? data;
  },
  /** Flags the record for deletion - it isn't removed until an Admin Officer approves. */
  async requestDelete(id) {
    const { data } = await http.post(`/api/income/${id}/request-delete`);
    return data?.data ?? data;
  },
  async approveDelete(id) {
    const { data } = await http.post(`/api/income/${id}/approve-delete`);
    return data?.data ?? data;
  },
  async rejectDelete(id) {
    const { data } = await http.post(`/api/income/${id}/reject-delete`);
    return data?.data ?? data;
  },
};

// expenditure api
export const expenditureApi = {
  async list(params = {}) {
    const { data } = await http.get("/api/expenditure", { params });
    return data;
  },
  /** approved_by is set server-side from the logged-in user - don't send it. */
  async create(body) {
    const { data } = await http.post("/api/expenditure", body);
    return data?.data ?? data;
  },
  /**
   * POST /api/expenditure/bulk - a whole spreadsheet in ONE request.
   *
   * The bulk upload dialog used to call create() once per row, which put a
   * large sheet straight through the API rate limiter (1000 requests per 15
   * minutes) and left it half-imported. Resolves to
   * { created, failed: [{ index, message }] } - partial success per row, not
   * all-or-nothing, where `index` is the position in the array passed here.
   */
  async bulkCreate(records) {
    const { data } = await http.post("/api/expenditure/bulk", { records });
    return data?.data ?? data;
  },
  async update(id, body) {
    const { data } = await http.put(`/api/expenditure/${id}`, body);
    return data?.data ?? data;
  },
  /** Flags the record for deletion - it isn't removed until an Admin Officer approves. */
  async requestDelete(id) {
    const { data } = await http.post(`/api/expenditure/${id}/request-delete`);
    return data?.data ?? data;
  },
  async approveDelete(id) {
    const { data } = await http.post(`/api/expenditure/${id}/approve-delete`);
    return data?.data ?? data;
  },
  async rejectDelete(id) {
    const { data } = await http.post(`/api/expenditure/${id}/reject-delete`);
    return data?.data ?? data;
  },
};
