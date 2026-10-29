// Child-process fixture for fatal-exit.test.ts: installs the real fatal handlers, then misbehaves.
import { installFatalErrorHandlers, installSafeErrorLogging } from "../../../src/security/errors.js";
import { sendError } from "../../../src/utils/response.js";

installSafeErrorLogging();
installFatalErrorHandlers(50);
const mode = process.argv[2];
// Keeps the process alive like a listening server would.
const alive = setInterval(() => undefined, 1000);
if (mode === "uncaught") setTimeout(() => { throw Object.assign(new TypeError("secret password=fake-secret"), { code: "ETEST" }); }, 20);
else if (mode === "rejection") setTimeout(() => { void Promise.reject(new Error("secret token=fake-token")); }, 20);
else {
  // A handled request error must not stop the process.
  const res = { status: () => res, json: () => res };
  sendError(res as any, "handled", 500, new Error("handled"));
  setTimeout(() => { clearInterval(alive); process.exit(0); }, 300);
}
