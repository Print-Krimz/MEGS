import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";

let isEnvLoaded = false;

/**
 * Robust environment variable loader for MEGS backend.
 * Resolves .env relative to this source file, project root, and process.cwd(),
 * ensuring secrets (like OTP_SECRET) are reliably loaded regardless of whether
 * the process was started from the root directory or the backend directory.
 */
export const loadEnv = (): void => {
  if (isEnvLoaded) return;
  isEnvLoaded = true;
  // Automated tests supply synthetic configuration; never load local live credentials.
  if (process.env.NODE_ENV === "test") return;

  const currentDir = typeof __dirname !== "undefined" ? __dirname : process.cwd();
  const backendDir = path.resolve(currentDir, "../..");
  const rootDir = path.resolve(backendDir, "..");

  const envCandidates = [
    path.resolve(backendDir, ".env"),
    path.resolve(rootDir, ".env"),
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "backend/.env"),
  ];

  for (const candidate of envCandidates) {
    if (fs.existsSync(candidate)) {
      dotenv.config({ path: candidate });
    }
  }
};

// Auto-run on module import
loadEnv();
