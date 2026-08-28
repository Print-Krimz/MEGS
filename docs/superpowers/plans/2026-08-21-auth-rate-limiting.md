# Authentication Rate Limiting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement robust, OWASP-compliant rate limiting across all authentication and password management endpoints (`/api/auth/login`, `/api/auth/register`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/setup-account`, and `/api/auth/change-password`) with proper proxy trust configuration.

**Architecture:** Install `express-rate-limit` in the Express 5 backend, configure `app.set('trust proxy', 1)` in `server.ts` for accurate client IP resolution behind proxies, create structured rate limiters in `rate-limiter.middleware.ts` with custom key generators combining IP and normalized email, and mount them as Express middleware in `auth.routes.ts`.

**Tech Stack:** Express 5.2.1, TypeScript 6.0.3, `express-rate-limit` ^7.5.0, Vitest 3.2.4, Supertest.

## Global Constraints

- Backend package directory: `c:\Users\cnico\OneDrive\Desktop\MEGS\backend`
- All responses must conform to the standard API response structure: `{ success: boolean, message: string, code?: string, retryAfter?: number }`
- HTTP status code for throttled requests must be `429 Too Many Requests`
- Standard headers must be enabled: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, and `Retry-After`
- Do not modify database schemas or existing Supabase auth contracts
- All new code must be fully type-safe in strict TypeScript without any type errors (`tsc --noEmit`)

---

### Task 1: Install `express-rate-limit` and Setup Rate Limiter Middleware

**Files:**
- Create: `backend/src/middleware/rate-limiter.middleware.ts`
- Test: `backend/src/__tests__/rate-limiter.test.ts`
- Modify: `backend/package.json`

**Interfaces:**
- Produces: 
  - `authLimiter: RateLimitRequestHandler` (10 requests / 15 minutes, keyed by IP + email)
  - `forgotPasswordLimiter: RateLimitRequestHandler` (3 requests / 1 hour, keyed by IP + email)
  - `rateLimitHandler(message: string, defaultRetrySeconds?: number): (req: Request, res: Response) => void`

- [ ] **Step 1: Install `express-rate-limit` in `backend`**

Run command in `backend/`:
```powershell
npm install express-rate-limit
```

- [ ] **Step 2: Write failing unit/integration tests for rate limiter middleware**

Create `backend/src/__tests__/rate-limiter.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import express, { Request, Response } from "express";
import request from "supertest";
import { authLimiter, forgotPasswordLimiter } from "../middleware/rate-limiter.middleware.js";

describe("Rate Limiter Middleware", () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.set("trust proxy", 1);
    app.use(express.json());
  });

  describe("authLimiter", () => {
    it("allows requests under the 10-attempt threshold and sets rate limit headers", async () => {
      app.post("/test-auth", authLimiter, (_req: Request, res: Response) => {
        res.json({ success: true, message: "OK" });
      });

      const res = await request(app)
        .post("/test-auth")
        .send({ email: "user@example.com", password: "password123" });

      expect(res.status).toBe(200);
      expect(res.headers["ratelimit-limit"]).toBe("10");
      expect(res.headers["ratelimit-remaining"]).toBeDefined();
    });

    it("blocks the 11th attempt with 429 and standard error body", async () => {
      app.post("/test-auth-block", authLimiter, (_req: Request, res: Response) => {
        res.json({ success: true, message: "OK" });
      });

      for (let i = 0; i < 10; i++) {
        await request(app)
          .post("/test-auth-block")
          .send({ email: "target@example.com" });
      }

      const blockedRes = await request(app)
        .post("/test-auth-block")
        .send({ email: "target@example.com" });

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.success).toBe(false);
      expect(blockedRes.body.code).toBe("RATE_LIMIT_EXCEEDED");
      expect(blockedRes.body.message).toContain("Too many authentication attempts");
      expect(blockedRes.headers["retry-after"]).toBeDefined();
    });
  });

  describe("forgotPasswordLimiter", () => {
    it("blocks after 3 password reset requests with 429", async () => {
      app.post("/test-forgot-block", forgotPasswordLimiter, (_req: Request, res: Response) => {
        res.json({ success: true, message: "Email sent" });
      });

      for (let i = 0; i < 3; i++) {
        await request(app)
          .post("/test-forgot-block")
          .send({ email: "reset@example.com" });
      }

      const blockedRes = await request(app)
        .post("/test-forgot-block")
        .send({ email: "reset@example.com" });

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.success).toBe(false);
      expect(blockedRes.body.code).toBe("RATE_LIMIT_EXCEEDED");
      expect(blockedRes.body.message).toContain("Too many password reset requests");
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run in `backend/`:
```powershell
npm test src/__tests__/rate-limiter.test.ts
```
Expected: FAIL with `Cannot find module '../middleware/rate-limiter.middleware.js'`

- [ ] **Step 4: Implement `backend/src/middleware/rate-limiter.middleware.ts`**

Write `backend/src/middleware/rate-limiter.middleware.ts`:
```typescript
import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";

/**
 * Standard RFC rate-limit response handler following MEGS unified response shape.
 */
export const rateLimitHandler = (message: string, defaultRetrySeconds: number = 900) => {
  return (req: Request, res: Response) => {
    const retryAfter = res.getHeader("Retry-After");
    const retrySeconds = retryAfter ? Number(retryAfter) : defaultRetrySeconds;

    res.status(429).json({
      success: false,
      message,
      code: "RATE_LIMIT_EXCEEDED",
      retryAfter: retrySeconds,
    });
  };
};

/**
 * Key generator combining client IP and lowercase email to mitigate distributed credential stuffing
 * while preventing single-IP collateral blocking when multiple users share an office gateway.
 */
export const authKeyGenerator = (req: Request): string => {
  const email = req.body?.email ? String(req.body.email).toLowerCase().trim() : "";
  const ip = req.ip || req.socket.remoteAddress || "unknown-ip";
  return email ? `${ip}_${email}` : ip;
};

/**
 * Key generator strictly keyed by normalized email (fallback to IP) for sensitive mail triggers.
 */
export const emailKeyGenerator = (req: Request): string => {
  const email = req.body?.email ? String(req.body.email).toLowerCase().trim() : "";
  const ip = req.ip || req.socket.remoteAddress || "unknown-ip";
  return email ? `mail_${email}` : `ip_${ip}`;
};

/**
 * Strict authentication limiter (Login, Registration, Token Resets, Setup Account, Change Password).
 * Limits to 10 requests per 15 minutes per IP+Email.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: authKeyGenerator,
  handler: rateLimitHandler("Too many authentication attempts. Please try again after 15 minutes.", 900),
});

/**
 * High-sensitivity limiter for Password Reset requests to prevent SMTP abuse and email flooding.
 * Limits to 3 requests per 60 minutes per Email/IP.
 */
export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: emailKeyGenerator,
  handler: rateLimitHandler("Too many password reset requests. Please wait an hour before requesting again.", 3600),
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run:
```powershell
npm test src/__tests__/rate-limiter.test.ts
```
Expected: PASS (all tests pass)

---

### Task 2: Configure `trust proxy` in `server.ts`

**Files:**
- Modify: `backend/server.ts:10-14`

**Interfaces:**
- Consumes: Express app instance
- Produces: Correct client IP detection via `X-Forwarded-For` header

- [ ] **Step 1: Add `trust proxy` configuration to `backend/server.ts`**

In `backend/server.ts`:
```typescript
const app = express();

// Trust first proxy (reverse proxy / load balancer / Vite dev proxy)
app.set("trust proxy", 1);

app.use(cors());
app.use(express.json());
```

- [ ] **Step 2: Verify server startup and existing test suites pass**

Run:
```powershell
npm test
```
Expected: PASS (all existing auth and workflow tests pass without regressions)

---

### Task 3: Mount Rate Limiters on Authentication Routes

**Files:**
- Modify: `backend/src/routes/core/auth.routes.ts`
- Test: `backend/src/__tests__/auth.test.ts`

**Interfaces:**
- Consumes: `authLimiter`, `forgotPasswordLimiter` from `rate-limiter.middleware.ts`
- Produces: Protected endpoints for `/register`, `/login`, `/forgot-password`, `/reset-password`, `/setup-account`, `/change-password`

- [ ] **Step 1: Update `backend/src/routes/core/auth.routes.ts` with rate limiting middleware**

Edit `backend/src/routes/core/auth.routes.ts`:
```typescript
import { Router } from "express";
import {
  register,
  login,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  setupAccount,
} from "../../controllers/core/auth.controller.js";
import { authenticateJWT } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { authSchema } from "../../schemas/auth.schema.js";
import {
  authLimiter,
  forgotPasswordLimiter,
} from "../../middleware/rate-limiter.middleware.js";

const router = Router();

// Public Auth Endpoints (Protected by Rate Limiters)
router.post("/register", authLimiter, validate(authSchema.register), register);
router.post("/login", authLimiter, validate(authSchema.login), login);
router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  validate(authSchema.forgotPassword),
  forgotPassword
);
router.post("/reset-password", authLimiter, validate(authSchema.resetPassword), resetPassword);
router.post("/setup-account", authLimiter, validate(authSchema.setupAccount), setupAccount);

// Authenticated Endpoints (Protected by Auth Limiter & JWT)
router.post(
  "/change-password",
  authenticateJWT,
  authLimiter,
  validate(authSchema.changePassword),
  changePassword
);
router.post("/logout", authenticateJWT, logout);

export default router;
```

- [ ] **Step 2: Add integration tests in `backend/src/__tests__/auth.test.ts` asserting route protection**

Add test cases at the bottom of `backend/src/__tests__/auth.test.ts`:
```typescript
  describe("Auth Rate Limiting Integration", () => {
    it("exports correctly structured router with rate limit middlewares mounted", async () => {
      const authRoutes = (await import("../routes/core/auth.routes.js")).default;
      expect(authRoutes).toBeDefined();
      expect(authRoutes.stack.length).toBeGreaterThanOrEqual(7);
    });
  });
```

- [ ] **Step 3: Run full backend test suite to verify zero regressions**

Run:
```powershell
npm test
```
Expected: All 18 test suites pass cleanly.

- [ ] **Step 4: Run typecheck to verify strict typing**

Run:
```powershell
npx tsc --noEmit
```
Expected: Clean exit (0 errors).

---

## Verification Plan

### Automated Tests
- Execute full test suite:
  ```powershell
  cd c:\Users\cnico\OneDrive\Desktop\MEGS\backend
  npm test
  ```
- Run targeted rate-limiting test suite:
  ```powershell
  npx vitest run src/__tests__/rate-limiter.test.ts
  ```
- Verify TypeScript types:
  ```powershell
  npx tsc --noEmit
  ```

### Manual Verification
- Start the backend server (`npm run dev`).
- Use `curl` or Postman to send 11 rapid requests to `http://localhost:3000/api/auth/login`:
  ```bash
  for i in {1..11}; do curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"invalid"}' -i; done
  ```
- Verify request #11 returns HTTP `429 Too Many Requests` with response headers `RateLimit-Remaining: 0`, `Retry-After: 900`, and error payload `{ "success": false, "code": "RATE_LIMIT_EXCEEDED", ... }`.
