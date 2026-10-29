import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";

// Real-socket preflight checks against the exported server.ts app (it only listens outside NODE_ENV=test).

vi.mock("../../src/utils/prisma.js", () => ({
  default: new Proxy({}, { get: () => new Proxy(() => undefined, { get: () => vi.fn(async () => null) }) }),
}));
vi.mock("../../src/utils/supabase.js", () => ({ default: {}, supabase: {} }));

import app from "../../server.js";

let server: http.Server;
let port: number;

const preflight = (origin: string) =>
  new Promise<http.IncomingMessage>((resolve, reject) => {
    const req = http.request(
      {
        port,
        host: "127.0.0.1",
        method: "OPTIONS",
        path: "/api/me",
        headers: {
          Origin: origin,
          "Access-Control-Request-Method": "GET",
          "Access-Control-Request-Headers": "authorization",
        },
      },
      res => {
        res.resume();
        res.on("end", () => resolve(res));
      }
    );
    req.on("error", reject);
    req.end();
  });

beforeAll(async () => {
  server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
});

describe("CORS preflight", () => {
  it("preflight from a trusted origin is cacheable for two hours", async () => {
    const res = await preflight("http://localhost:5173");
    expect(res.statusCode).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(res.headers["access-control-max-age"]).toBe("7200");
  });

  it("untrusted origin gets no allow-origin header", async () => {
    const res = await preflight("https://evil.example");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
