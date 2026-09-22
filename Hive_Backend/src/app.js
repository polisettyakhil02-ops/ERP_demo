import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/authRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import publicRoutes from "./routes/publicRoutes.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import studentRoutes from "./routes/studentRoutes.js";
import classRoutes from "./routes/classRoutes.js";
import feeStructureRoutes from "./routes/feeStructureRoutes.js";
import attendanceRouter from "./routes/attendanceRoutes.js";
import marksRouter from "./routes/marksRoutes.js";
import homeworkRouter from "./routes/homeworkRouter.js";
import userRouter from "./routes/userRouter.js";
import branchRouter from "./routes/branchRouter.js";
import schoolRouter from "./routes/schoolRoutes.js";
import admissionRouter from "./routes/admissionRoutes.js";
import studentFeeReportRoutes from "./routes/studentFeeReportRoutes.js";
import incomeRoutes from "./routes/incomeRoutes.js";
import expenditureRoutes from "./routes/expenditureRoutes.js";
import feePaymentRoutes from "./routes/feePaymentRouter.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import transferRoutes from "./routes/transferRoutes.js";
import backDateRequestRoutes from "./routes/backDateRequestRoutes.js";
import concessionRoutes from "./routes/concessionRoutes.js";
import busRouteRoutes from "./routes/busRouteRoutes.js";
import feeReceiptCancellationRoutes from "./routes/feeReceiptCancellationRoutes.js";
import ticketRoutes from "./routes/ticketRoutes.js";
import examScheduleRouter from "./routes/examScheduleRoutes.js";
import subjectRoutes from "./routes/subjectRoutes.js";
import featureRequestRoutes from "./routes/featureRequestRoutes.js";

dotenv.config();

const app = express();
app.set("trust proxy", 1);
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  }),
);
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 1000,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.use(
  helmet({
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }, // Local -> comment this line
    // hsts: { maxAge: 0 }, //   Local -> Uncomment this line
    noSniff: true,
    dnsPrefetchControl: { allow: false },
    hidePoweredBy: true,
    referrerPolicy: { policy: "no-referrer" },
    // Without this, helmet's default (same-origin) blocks the browser (not
    // curl/server-to-server calls) from loading anything under /uploads
    // when the frontend and backend are on different origins/ports - e.g.
    // a school logo uploaded via Manage Schools. There used to be a second,
    // earlier helmet() call that only set this - since both ran on every
    // request, this later one silently won and re-enabled the block. Merged
    // into one call so there's a single source of truth for these headers.
    crossOriginResourcePolicy: false,
  }),
);

app.use("/uploads", express.static(path.resolve("uploads")));

app.get("/health", (req, res) =>
  res.json({ status: "ok", time: new Date().toISOString() }),
);

app.use("/api/public", publicRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRouter);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/attendance", attendanceRouter);
app.use("/api/marks", marksRouter);
app.use("/api/homework", homeworkRouter);
app.use("/api/admissions", admissionRouter);
app.use("/api/branches", branchRouter);
app.use("/api/schools", schoolRouter);
app.use("/api/fee-structures", feeStructureRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/fee", studentFeeReportRoutes);
app.use("/api/income", incomeRoutes);
app.use("/api/expenditure", expenditureRoutes);
app.use("/api/transfers", transferRoutes);
app.use("/api/back-date-requests", backDateRequestRoutes);
app.use("/api/concession-change-requests", concessionRoutes);
app.use("/api/bus-routes", busRouteRoutes);
app.use("/api/fee-receipt-cancellation-requests", feeReceiptCancellationRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/exam-schedules", examScheduleRouter);
app.use("/api/subjects", subjectRoutes);
app.use("/api/feature-requests", featureRequestRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
