import { Router } from "express";
import {
  requestCancelReceipt,
  listFeeReceiptCancellationRequests,
  approveCancelReceiptRequest,
  rejectCancelReceiptRequest,
} from "../controllers/feeController.js";
import { requireAuth } from "../middleware/auth.js";

const feeReceiptCancellationRoutes = Router();
feeReceiptCancellationRoutes.use(requireAuth);

feeReceiptCancellationRoutes.get("/", listFeeReceiptCancellationRequests);
feeReceiptCancellationRoutes.post("/", requestCancelReceipt);
feeReceiptCancellationRoutes.put("/:id/approve", approveCancelReceiptRequest);
feeReceiptCancellationRoutes.put("/:id/reject", rejectCancelReceiptRequest);

export default feeReceiptCancellationRoutes;
