import "./src/utils/env.js";

import express from "express";
import cors from "cors";
import authRoutes from "./src/routes/core/auth.routes.js";
import { authenticateJWT } from "./src/middleware/auth.middleware.js";
import { sendSuccess, sendError } from "./src/utils/response.js";
import { allowedOrigins, proxyTrust, validateRuntimeSecurity } from "./src/security/runtime-config.js";
import { installSafeErrorLogging, safeLogError } from "./src/security/errors.js";
import { connectSharedStore } from "./src/security/shared-store.js";
import { startEmailWorker } from "./src/workers/email.worker.js";

const app = express();

installSafeErrorLogging();
validateRuntimeSecurity();
app.set("trust proxy", proxyTrust());
const trustedOrigins = allowedOrigins();

app.use(
  cors({
    origin: (origin, callback) => callback(null, !origin || trustedOrigins.has(origin)),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "x-turnstile-token",
      "X-Turnstile-Token",
      "cf-turnstile-response",
    ],
  })
);
app.use(express.json());

// Public health check & browser auth forwarder
app.get("/", (req, res) => {
  if (req.accepts("html") && !req.xhr && req.headers["sec-fetch-dest"] === "document") {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    return res.send(`<!DOCTYPE html>
<html>
  <head><title>Redirecting to MEGS...</title></head>
  <body>
    <script>
      const targetPath = window.location.hash.includes("type=recovery") ? "/reset-password" : window.location.pathname;
      window.location.replace("${frontendUrl}" + targetPath + window.location.search + window.location.hash);
    </script>
    <p>Redirecting to MEGS... <a href="${frontendUrl}">Click here if not redirected automatically.</a></p>
  </body>
</html>`);
  }
  res.json({
    success: true,
    message: "Recruitment Management System API is running ✅",
  });
});

app.get("/reset-password", (_req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  res.send(`<!DOCTYPE html>
<html>
  <head><title>Redirecting to Set Password...</title></head>
  <body>
    <script>
      window.location.replace("${frontendUrl}/reset-password" + window.location.search + window.location.hash);
    </script>
    <p>Redirecting to Set Password... <a href="${frontendUrl}/reset-password">Click here if not redirected.</a></p>
  </body>
</html>`);
});

app.use("/api/auth", authRoutes);

import configRoutes from "./src/routes/core/config.routes.js";
app.use("/api/config", configRoutes);
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

// Global Error Handler (Multer file limits, validation, and runtime exceptions)
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!err) return next();
  if (err.name === "MulterError") {
    return res.status(400).json({
      success: false,
      message: err.code === "LIMIT_FILE_SIZE"
        ? `File size exceeds the maximum limit of ${_req.path === "/api/admin/maintenance/backups/restore-upload" ? "50" : "5"} MB. Please select a smaller file.`
        : "The upload has invalid fields or too many files. Please select one supported file.",
    });
  }
  safeLogError("Request processing", err);
  return sendError(res, err.message, err.status || 500);
});

const PORT = process.env.PORT ?? 3000;

connectSharedStore().then(() => {
  app.listen(PORT, () => console.log(`✅ Server listening on port ${PORT}`));
}).catch(error => {
  safeLogError("Security store startup", error);
  process.exitCode = 1;
});

process.on("unhandledRejection", (reason) => {
  safeLogError("Unhandled rejection", reason);
});

process.on("uncaughtException", (error) => {
  safeLogError("Uncaught exception", error);
});

// Email worker polling loop decommissioned to prevent empty database queries
// startEmailWorker();

