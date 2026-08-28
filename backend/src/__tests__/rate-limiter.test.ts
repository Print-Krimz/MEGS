import { describe, it, expect, beforeEach } from "vitest";
import express, { Request, Response } from "express";
import request from "supertest";
import {
  authLimiter,
  forgotPasswordLimiter,
  authKeyGenerator,
  emailKeyGenerator,
} from "../middleware/rate-limiter.middleware.js";

describe("Rate Limiter Middleware", () => {
  describe("Key Generators", () => {
    it("authKeyGenerator combines IP and lowercase normalized email when email is present", () => {
      const req: any = {
        ip: "192.168.1.50",
        body: { email: "  TestUser@Example.COM " },
      };
      expect(authKeyGenerator(req)).toBe("192.168.1.50_testuser@example.com");
    });

    it("authKeyGenerator falls back to IP when email is absent", () => {
      const req: any = {
        ip: "192.168.1.50",
        body: {},
      };
      expect(authKeyGenerator(req)).toBe("192.168.1.50");
    });

    it("emailKeyGenerator prefixes mail_ with normalized email when present", () => {
      const req: any = {
        ip: "192.168.1.50",
        body: { email: "Candidate@DOMAIN.COM" },
      };
      expect(emailKeyGenerator(req)).toBe("mail_candidate@domain.com");
    });

    it("emailKeyGenerator falls back to ip_ when email is absent", () => {
      const req: any = {
        ip: "192.168.1.50",
        body: {},
      };
      expect(emailKeyGenerator(req)).toBe("ip_192.168.1.50");
    });
  });

  describe("authLimiter (Integration)", () => {
    let app: express.Express;

    beforeEach(() => {
      app = express();
      app.set("trust proxy", 1);
      app.use(express.json());
    });

    it("allows requests under the 10-attempt threshold and sets RFC standard rate limit headers", async () => {
      app.post("/test-auth", authLimiter, (_req: Request, res: Response) => {
        res.json({ success: true, message: "OK" });
      });

      const res = await request(app)
        .post("/test-auth")
        .send({ email: "fresh-user@example.com", password: "password123" });

      expect(res.status).toBe(200);
      expect(res.headers["ratelimit-limit"]).toBe("10");
      expect(res.headers["ratelimit-remaining"]).toBeDefined();
    });

    it("blocks on exceeding 10 attempts with 429 and standard error response body", async () => {
      app.post("/test-auth-block", authLimiter, (_req: Request, res: Response) => {
        res.json({ success: true, message: "OK" });
      });

      const targetEmail = "brute-target@example.com";

      // 10 allowed attempts
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post("/test-auth-block")
          .send({ email: targetEmail });
      }

      // 11th attempt must be blocked
      const blockedRes = await request(app)
        .post("/test-auth-block")
        .send({ email: targetEmail });

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.success).toBe(false);
      expect(blockedRes.body.code).toBe("RATE_LIMIT_EXCEEDED");
      expect(blockedRes.body.message).toContain("Too many authentication attempts");
      expect(blockedRes.headers["retry-after"]).toBeDefined();
    });
  });

  describe("forgotPasswordLimiter (Integration)", () => {
    let app: express.Express;

    beforeEach(() => {
      app = express();
      app.set("trust proxy", 1);
      app.use(express.json());
    });

    it("blocks after 3 password reset requests with 429", async () => {
      app.post("/test-forgot-block", forgotPasswordLimiter, (_req: Request, res: Response) => {
        res.json({ success: true, message: "Email sent" });
      });

      const email = "reset-bomb@example.com";

      // 3 allowed requests
      for (let i = 0; i < 3; i++) {
        const res = await request(app)
          .post("/test-forgot-block")
          .send({ email });
        expect(res.status).toBe(200);
      }

      // 4th request must be blocked
      const blockedRes = await request(app)
        .post("/test-forgot-block")
        .send({ email });

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.success).toBe(false);
      expect(blockedRes.body.code).toBe("RATE_LIMIT_EXCEEDED");
      expect(blockedRes.body.message).toContain("Too many password reset requests");
    });
  });
});
