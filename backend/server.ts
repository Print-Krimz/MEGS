import "dotenv/config";

import express from "express";
import cors from "cors";
import authRoutes from "./src/routes/core/auth.routes.js";
import { authenticateJWT } from "./src/middleware/auth.middleware.js";
import { sendSuccess } from "./src/utils/response.js";
import { startEmailWorker } from "./src/workers/email.worker.js";

const app = express();

app.use(cors());
app.use(express.json());

// Public health check
app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "Recruitment Management System API is running ✅",
  });
});

app.use("/api/auth", authRoutes);

// Auth verification endpoint: GET /api/me (Bearer <token>)
app.get("/api/me", authenticateJWT, (req, res) => {
  sendSuccess(res, "Token is valid", { user: req.user });
});

import applicantRoutes from "./src/routes/applicant/applicant.routes.js";
app.use("/api/applicants", applicantRoutes);

import applicationRoutes from "./src/routes/applicant/application.routes.js";
app.use("/api/applicant-jobs", applicationRoutes);

import taRoutes from "./src/routes/ta/ta.routes.js";
app.use("/api/ta", taRoutes);

import adminRoutes from "./src/routes/admin/admin.routes.js";
app.use("/api/admin", adminRoutes);

import notificationRoutes from "./src/routes/core/notification.routes.js";
app.use("/api/notifications", notificationRoutes);

import documentRoutes from "./src/routes/core/documents.routes.js";
app.use("/api/documents", documentRoutes);

import employeeRoutes from "./src/routes/employee/employee.routes.js";
app.use("/api/employees", employeeRoutes);

const PORT = process.env.PORT ?? 3000;

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});

startEmailWorker();

