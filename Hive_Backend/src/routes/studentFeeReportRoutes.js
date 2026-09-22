// routes/studentFeeReport.routes.js
import express from "express";

import { requireAuth } from "../middleware/auth.js";
import {
  listReports,
  reportSummary,
  listPendingFees,
  createReport,
  updateReport,
  removeReport,
  listPayments,
  paymentsSummary,
  listEligibleStudents,
  itemPaymentTotals,
  collectPayment,
  createPayment,
  updatePayment,
  removePayment,
  cancelReceipt,
  listCategoryReport,
  categoryReportSummary,
  classConsolidatedReport,
  listPendingReport,
  pendingReportSummary,
} from "../controllers/feeController.js";

const studentFeeReportRoutes = express.Router();

studentFeeReportRoutes.use(requireAuth);
studentFeeReportRoutes.get("/eligible-students", listEligibleStudents);
studentFeeReportRoutes.get("/item-payments", itemPaymentTotals);
studentFeeReportRoutes.get("/report-summary", reportSummary);
studentFeeReportRoutes.get("/pending", listPendingFees);
studentFeeReportRoutes.get("/payments-summary", paymentsSummary);
// Old/Admission/Term/Transport/Hostel/Application/Registration/Kit Amount/
// Other Income/Inactive Students reports - one param (?category=) picks
// which scoped query runs, see listCategoryReport in feeController.js.
studentFeeReportRoutes.get("/category-report", listCategoryReport);
studentFeeReportRoutes.get("/category-report-summary", categoryReportSummary);
studentFeeReportRoutes.get("/class-consolidated-report", classConsolidatedReport);
// Student-wise Pending Dues Report - who owes what, across every fee
// bucket plus old_fee (see listPendingReport). Distinct from "/pending"
// above, which is the fee-collection screen's eligible-student lookup.
studentFeeReportRoutes.get("/pending-report", listPendingReport);
studentFeeReportRoutes.get("/pending-report-summary", pendingReportSummary);

studentFeeReportRoutes.get("/", listReports);
studentFeeReportRoutes.get("/listPayments", listPayments);
studentFeeReportRoutes.post("/", createReport);
studentFeeReportRoutes.put("/:id", updateReport);
studentFeeReportRoutes.delete("/:id", removeReport);
studentFeeReportRoutes.post("/createpayment", createPayment);
studentFeeReportRoutes.post("/collectpayment", collectPayment);
studentFeeReportRoutes.post("/cancelReceipt", cancelReceipt);
// NOTE: previously registered as POST "/updatepayment" / POST "/removePayment"
// with no :id segment, which never matched what the frontend actually calls
// (feeApi.updatePayment/removePayment in api.js send PUT/DELETE .../:id) -
// fixed to match, since nothing else in the app called the old paths.
studentFeeReportRoutes.put("/updatePayment/:id", updatePayment);
studentFeeReportRoutes.delete("/removePayment/:id", removePayment);

export default studentFeeReportRoutes;

// In your app entrypoint (e.g. server.js / app.js):
//   import studentFeeReportRoutes from "./routes/studentFeeReport.routes.js";
//   app.use("/api/student-fee-reports", studentFeeReportRoutes);
