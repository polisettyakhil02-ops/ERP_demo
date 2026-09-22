import {
  backDateRequestApi,
  studentApi,
  userApi,
  concessionApi,
  feeReceiptCancellationApi,
  incomeApi,
  expenditureApi,
} from "@/api/api";

// Every notification `type` that can be decided directly from wherever it's
// shown (the bell popover, the full Notifications page) instead of sending
// the approver back to the Students/Staff page to find the same record
// again. Each entry says which Notification field points at the real record
// to act on, and which endpoint actually approves/rejects it - the
// notification itself is only ever resolved as a side effect of that call,
// never directly (see notificationController.js's resolve(), which refuses
// to resolve one of these types on its own for exactly this reason).
// `staff_transfer_reassignment` is deliberately absent - it has no
// accept/reject of its own (the real fix happens on the Classes page), so
// it stays on the generic "Mark done" path.
//
// Shared by NotificationBell.jsx and NotificationsPage.jsx so they can never
// drift out of sync again - the bell used to hand-roll only
// `back_date_request` and silently fell back to "Mark done" (which does
// nothing but resolve the notification) for every type added here since,
// letting an Admin Officer "clear" a pending deletion/cancellation request
// from the bell without ever actually approving or rejecting it.
export const ACTIONABLE_TYPES = {
  back_date_request: {
    label: "Back-date request",
    idField: "related_record_id",
    approve: (id) => backDateRequestApi.approve(id),
    reject: (id) => backDateRequestApi.reject(id),
  },
  student_delete_request: {
    label: "Student delete request",
    idField: "related_student_id",
    approve: (id) => studentApi.approveDelete(id),
    reject: (id) => studentApi.rejectDelete(id),
  },
  student_status_change_request: {
    label: "Student status change request",
    idField: "related_student_id",
    approve: (id) => studentApi.approveStatusChange(id),
    reject: (id) => studentApi.rejectStatusChange(id),
  },
  student_addition_request: {
    label: "Student addition request",
    idField: "related_record_id",
    approve: (id) => studentApi.approveAddition(id),
    reject: (id) => studentApi.rejectAddition(id),
  },
  staff_delete_request: {
    label: "Staff deactivation request",
    idField: "related_staff_id",
    approve: (id) => userApi.approveDelete(id),
    reject: (id) => userApi.rejectDelete(id),
  },
  concession_change_request: {
    label: "Concession change request",
    idField: "related_record_id",
    approve: (id) => concessionApi.approve(id),
    reject: (id) => concessionApi.reject(id),
  },
  fee_receipt_cancellation_request: {
    label: "Fee receipt cancellation request",
    idField: "related_record_id",
    approve: (id) => feeReceiptCancellationApi.approve(id),
    reject: (id) => feeReceiptCancellationApi.reject(id),
  },
  income_delete_request: {
    label: "Income deletion request",
    idField: "related_record_id",
    approve: (id) => incomeApi.approveDelete(id),
    reject: (id) => incomeApi.rejectDelete(id),
  },
  expenditure_delete_request: {
    label: "Expenditure deletion request",
    idField: "related_record_id",
    approve: (id) => expenditureApi.approveDelete(id),
    reject: (id) => expenditureApi.rejectDelete(id),
  },
};
