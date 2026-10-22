import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import cors from "cors";
import compression from "compression";

// Real-socket checks for the public SSE streams. Only the public router is mounted,
// with the same proxy, CORS, compression and API cache headers as server.ts.

const mocks = vi.hoisted(() => ({
  appFindUnique: vi.fn(),
  appFindMany: vi.fn(),
  checkInFindUnique: vi.fn(),
  checkInFindMany: vi.fn(),
  queryRaw: vi.fn(),
  rawCounts: new Map<string, number>(),
}));

vi.mock("../../src/utils/prisma.js", () => ({
  default: {
    application: { findUnique: mocks.appFindUnique, findMany: mocks.appFindMany },
    walkInCheckIn: { findUnique: mocks.checkInFindUnique, findMany: mocks.checkInFindMany },
    $queryRaw: mocks.queryRaw,
    $executeRaw: vi.fn(async () => 0),
  },
}));
vi.mock("../../src/utils/supabase.js", () => ({ default: {}, supabase: {} }));

import publicRouter from "../../src/routes/public/public.routes.js";
import { allowedOrigins, proxyTrust } from "../../src/security/runtime-config.js";
import { __liveHubStats } from "../../src/services/live-updates.service.js";
import { hashToken } from "../../src/services/ta/walk-in-tokens.js";

const TOKEN = "good-token";
const CODE = "WLK-2026-0001";
const STREAM = `/api/public/track/${CODE}/stream`;

// Fixed-window counter in place of the Postgres store, keyed the same way.
const limiterIncrement = (_strings: TemplateStringsArray, key: unknown) => {
  const k = String(key);
  const hits = (mocks.rawCounts.get(k) ?? 0) + 1;
  mocks.rawCounts.set(k, hits);
  return Promise.resolve([{ hits, expiresAt: new Date(Date.now() + 15 * 60_000) }]);
};

const trusted = allowedOrigins({ NODE_ENV: "test" });
const app = express();
app.set("trust proxy", proxyTrust({ TRUST_PROXY: "1" }));
app.use(
  cors({
    origin: (origin, callback) => callback(null, !origin || trusted.has(origin)),
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
      "x-tracking-token",
      "x-check-in-token",
    ],
  })
);
app.use(
  compression({
    filter: (req, res) => {
      if (req.headers.accept?.includes("text/event-stream")) return false;
      return compression.filter(req, res);
    },
  })
);
app.use(express.json());
app.get("/control/large", (_req, res) => {
  res.json({ items: Array.from({ length: 150 }, (_, i) => ({ id: i, note: "control payload for gzip" })) });
});
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  next();
});
app.use("/api/public", publicRouter);

type Conn = { status: number; headers: http.IncomingHttpHeaders; text: string; ended: Promise<void>; destroy: () => void };

let server: http.Server;
let port = 0;
const opened: Conn[] = [];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const until = async (check: () => boolean, ms: number, what: string) => {
  const deadline = Date.now() + ms;
  while (!check()) {
    if (Date.now() >= deadline) throw new Error(`timed out waiting for ${what}`);
    await sleep(10);
  }
};

const send = (method: string, path: string, headers: Record<string, string> = {}): Promise<Conn> =>
  new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path,
        method,
        agent: false,
        headers: { Accept: "text/event-stream", "Accept-Encoding": "gzip, deflate", ...headers },
      },
      (res) => {
        res.setEncoding("utf8");
        const conn: Conn = {
          status: res.statusCode ?? 0,
          headers: res.headers,
          text: "",
          ended: new Promise<void>((done) => {
            res.once("end", done);
            res.once("close", done);
          }),
          destroy: () => req.destroy(),
        };
        res.on("data", (chunk: string) => {
          conn.text += chunk;
        });
        res.on("error", () => {});
        opened.push(conn);
        resolve(conn);
      }
    );
    req.on("error", reject);
    req.end();
  });

const appRow = (status: string, at: number) => ({ id: 5, status, updatedAt: new Date(at), interviews: [] });

beforeAll(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  mocks.appFindUnique.mockReset().mockResolvedValue({ id: 5, trackingTokenHash: hashToken(TOKEN) });
  mocks.appFindMany.mockReset().mockResolvedValue([appRow("APPLIED", 1)]);
  mocks.checkInFindUnique.mockReset().mockResolvedValue(null);
  mocks.checkInFindMany.mockReset().mockResolvedValue([]);
  mocks.queryRaw.mockReset().mockImplementation(limiterIncrement);
  mocks.rawCounts.clear();
  expect(__liveHubStats()).toEqual({ subscribers: 0, timerRunning: false });
});

afterEach(async () => {
  for (const conn of opened.splice(0)) conn.destroy();
  await until(() => __liveHubStats().subscribers === 0 && !__liveHubStats().timerRunning, 3000, "hub to drain");
});

describe("public live streams over real HTTP", () => {
  it("answers a valid token with an uncompressed, flushed event stream", async () => {
    const started = performance.now();
    const conn = await send("GET", STREAM, { "x-tracking-token": TOKEN });
    expect(conn.status).toBe(200);
    expect(conn.headers["content-type"]).toBe("text/event-stream");
    expect(conn.headers["cache-control"]).toContain("no-cache");
    expect(conn.headers["cache-control"]).toContain("no-transform");
    expect(conn.headers["content-encoding"]).toBeUndefined();
    expect(conn.headers["x-accel-buffering"]).toBe("no");
    await until(() => conn.text.includes("event: ready\ndata: {}\n\n"), 1000, "ready event");
    expect(performance.now() - started).toBeLessThan(1000);
    expect(conn.text).toBe("retry: 15000\n\nevent: ready\ndata: {}\n\n");
  });

  it("control: gzip is live on this app, so the stream's missing Content-Encoding comes from the filter", async () => {
    const conn = await send("GET", "/control/large", { Accept: "application/json" });
    await conn.ended;
    expect(conn.status).toBe(200);
    expect(conn.headers["content-encoding"]).toBe("gzip");
  });

  describe("token gate", () => {
    it.each([
      ["no token", {}, STREAM],
      ["wrong token", { "x-tracking-token": "not-the-token" }, STREAM],
      ["empty token", { "x-tracking-token": "" }, STREAM],
      ["token only in the query string", {}, `${STREAM}?x-tracking-token=${TOKEN}`],
    ])("%s gets a plain JSON 404, never a stream", async (_name, headers, path) => {
      const conn = await send("GET", path, headers);
      await conn.ended;
      expect(conn.status).toBe(404);
      expect(conn.headers["content-type"]).toMatch(/application\/json/);
      expect(conn.headers["cache-control"]).toBe("no-store");
      expect(JSON.parse(conn.text)).toMatchObject({ success: false });
      expect(__liveHubStats().subscribers).toBe(0);
    });
  });

  it("sends changed within one 3 s tick of a row change, and the event carries no data", async () => {
    const conn = await send("GET", STREAM, { "x-tracking-token": TOKEN });
    expect(conn.status).toBe(200);
    await until(() => conn.text.includes("event: ready"), 1000, "ready event");

    // The first tick only records a baseline. Change the row after that tick has run.
    const ticksSoFar = mocks.appFindMany.mock.calls.length;
    await until(() => mocks.appFindMany.mock.calls.length > ticksSoFar, 4000, "baseline tick");
    mocks.appFindMany.mockResolvedValue([appRow("INTERVIEW", 2)]);
    const changedAt = performance.now();
    await until(() => conn.text.includes("event: changed\ndata: {}\n\n"), 3500, "changed event");
    expect(performance.now() - changedAt).toBeLessThan(3500);
    expect(conn.text).not.toMatch(/INTERVIEW|APPLIED/);
  }, 15_000);

  it("caps four open streams per IP, answers the fifth with 429 and Retry-After, and frees the slot on close", async () => {
    const streams: Conn[] = [];
    for (let i = 0; i < 4; i++) {
      const conn = await send("GET", STREAM, { "x-tracking-token": TOKEN });
      expect(conn.status).toBe(200);
      streams.push(conn);
    }
    await until(() => streams.every((conn) => conn.text.includes("event: ready")), 1000, "four ready events");

    const over = await send("GET", STREAM, { "x-tracking-token": TOKEN });
    await over.ended;
    expect(over.status).toBe(429);
    expect(over.headers["retry-after"]).toBe("30");
    expect(over.headers["content-type"]).toMatch(/application\/json/);
    expect(JSON.parse(over.text).success).toBe(false);

    streams[0].destroy();
    await until(() => __liveHubStats().subscribers === 3, 1000, "slot to be released");
    const again = await send("GET", STREAM, { "x-tracking-token": TOKEN });
    expect(again.status).toBe(200);
  });

  it("unsubscribes and stops the hub timer when the client socket closes", async () => {
    const conn = await send("GET", STREAM, { "x-tracking-token": TOKEN });
    await until(() => conn.text.includes("event: ready"), 1000, "ready event");
    expect(__liveHubStats()).toEqual({ subscribers: 1, timerRunning: true });

    conn.destroy();
    await until(() => __liveHubStats().subscribers === 0, 1000, "unsubscribe after socket close");
    expect(__liveHubStats()).toEqual({ subscribers: 0, timerRunning: false });
  });

  it("allows the token headers in a CORS preflight from the app origin, and no origin for an unlisted one", async () => {
    const preflight = await send("OPTIONS", STREAM, {
      Origin: "http://localhost:5173",
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Headers": "x-tracking-token",
    });
    await preflight.ended;
    expect(preflight.status).toBe(204);
    expect(preflight.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(preflight.headers["access-control-allow-credentials"]).toBe("true");
    const allowed = String(preflight.headers["access-control-allow-headers"]).toLowerCase().split(",").map((h) => h.trim());
    expect(allowed).toEqual(expect.arrayContaining(["x-tracking-token", "x-check-in-token"]));

    const foreign = await send("OPTIONS", STREAM, {
      Origin: "https://evil.example",
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Headers": "x-tracking-token",
    });
    await foreign.ended;
    expect(foreign.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("control: publicLimiter answers the 61st public tracking GET with 429", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 61; i++) {
      const conn = await send("GET", `/api/public/track/${CODE}`);
      await conn.ended;
      statuses.push(conn.status);
    }
    expect(statuses[60]).toBe(429);
  });

  it("DEFECT public.routes.ts:23-26: wrong-token stream requests skip publicLimiter, so all 61 reach the database", async () => {
    // Expected: the limiter that guards the same lookup also counts failed stream attempts.
    const statuses: number[] = [];
    for (let i = 0; i < 61; i++) {
      const conn = await send("GET", STREAM, { "x-tracking-token": `guess-${i}` });
      await conn.ended;
      statuses.push(conn.status);
    }
    expect(statuses[60]).toBe(429);
  });

  it("DEFECT public-live.controller.ts:57: the per-IP cap keys raw IPv6 addresses, so one /56 gets 4 per address, not 4 total", async () => {
    // Expected: publicLimiter groups IPv6 by /56 (ipKeyGenerator), so the fifth stream from the same prefix gets 429.
    const statuses: number[] = [];
    for (let i = 1; i <= 5; i++) {
      const conn = await send("GET", STREAM, { "x-tracking-token": TOKEN, "X-Forwarded-For": `2001:db8:1:2::${i}` });
      statuses.push(conn.status);
    }
    expect(statuses.slice(0, 4)).toEqual([200, 200, 200, 200]);
    expect(statuses[4]).toBe(429);
  });
});
