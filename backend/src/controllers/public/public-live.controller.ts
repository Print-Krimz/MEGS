import type { Request, Response } from "express";
import prisma from "../../utils/prisma.js";
import { sendError } from "../../utils/response.js";
import { tokenMatches } from "../../services/ta/walk-in-tokens.js";
import { subscribeLive } from "../../services/live-updates.service.js";
import { clientIp } from "../../middleware/rate-limiter.middleware.js";
import { safeLogError } from "../../security/errors.js";

// Server-Sent Events for the two public pages. The stream carries no data: a "changed" event
// tells the page to refetch the existing masked JSON endpoint. The secret travels in a header, never the URL.

const RETRY = "retry: 15000\n\n";
const READY = "event: ready\ndata: {}\n\n";
const CHANGED = "event: changed\ndata: {}\n\n";
const KEEP_ALIVE = ": keep-alive\n\n";
const MAX_PER_IP = 4;
const MAX_TOTAL = 300;
const KEEP_ALIVE_MS = 25_000; // Heroku cuts idle connections at 55 s
const MAX_LIFETIME_MS = 15 * 60 * 1000; // the client reconnects

const perIp = new Map<string, number>();
let total = 0;

const acquire = (ip: string): boolean => {
  if (total >= MAX_TOTAL || (perIp.get(ip) ?? 0) >= MAX_PER_IP) return false;
  total += 1;
  perIp.set(ip, (perIp.get(ip) ?? 0) + 1);
  return true;
};

const release = (ip: string) => {
  total = Math.max(0, total - 1);
  const left = (perIp.get(ip) ?? 0) - 1;
  if (left > 0) perIp.set(ip, left);
  else perIp.delete(ip);
};

const header = (req: Request, name: string): string => {
  const value = req.headers[name];
  return typeof value === "string" ? value : "";
};

const notFound = (res: Response) => {
  res.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
  sendError(res, "Not found", 404);
};

type Target = {
  subscribe: { kind: "application" | "checkIn"; id: number };
  ends?: () => Promise<boolean>;
  expiresAt?: Date;
};
type Gate = { check: () => Promise<Target | null> };

const openStream = async (req: Request, res: Response, gate: Gate): Promise<void> => {
  const ip = clientIp(req);
  let closed = false;
  let slot = false;
  let unsubscribe: () => void = () => {};
  let keepAlive: ReturnType<typeof setInterval> | undefined;
  let lifetime: ReturnType<typeof setTimeout> | undefined;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  // Registered before the awaited token check so a client that leaves during it is noticed.
  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(keepAlive);
    clearTimeout(lifetime);
    clearTimeout(expiry);
    unsubscribe();
    if (slot) { slot = false; release(ip); }
    res.off("close", close);
    res.off("error", close);
    if (!res.writableEnded) res.end();
  };
  res.on("close", close);
  res.on("error", close);

  let target: Target | null = null;
  try {
    target = await gate.check();
  } catch (error) {
    safeLogError("Live updates: token check", error);
    if (!closed) {
      res.set({ "Cache-Control": "no-store", "Retry-After": "15" });
      sendError(res, "Temporarily unavailable", 503);
    }
    return;
  }
  if (closed) return;
  if (!target) {
    notFound(res);
    return;
  }
  if (!acquire(ip)) {
    res.set({ "Cache-Control": "no-store", "Retry-After": "30" });
    sendError(res, "Too many open connections", 429);
    return;
  }
  slot = true;

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.flushHeaders();
  res.write(RETRY);
  res.write(READY);

  const { ends, subscribe, expiresAt } = target;
  unsubscribe = subscribeLive(subscribe, () => {
    if (closed) return;
    res.write(CHANGED);
    if (ends) {
      void ends()
        .then((over) => { if (over) close(); })
        .catch((error) => safeLogError("Live updates: check-in end check", error));
    }
  });
  keepAlive = setInterval(() => { if (!closed) res.write(KEEP_ALIVE); }, KEEP_ALIVE_MS);
  lifetime = setTimeout(close, MAX_LIFETIME_MS);
  if (expiresAt) {
    // A pending check-in lapses at expiresAt: tell the page to refetch (it gets 404), then end.
    const wait = expiresAt.getTime() - Date.now();
    expiry = setTimeout(() => {
      if (closed) return;
      res.write(CHANGED);
      close();
    }, Math.min(Math.max(wait, 0), MAX_LIFETIME_MS));
  }
};

// GET /api/public/track/:code/stream - header x-tracking-token
export const streamTrackingHandler = (req: Request, res: Response): Promise<void> =>
  openStream(req, res, {
    check: async () => {
      const code = String(req.params.code ?? "");
      const token = header(req, "x-tracking-token");
      if (!code || !token || code.length > 40 || token.length > 100) return null;
      const app = await prisma.application.findUnique({
        where: { trackingCode: code.trim().toUpperCase() },
        select: { id: true, trackingTokenHash: true },
      });
      if (!app || !tokenMatches(token, app.trackingTokenHash)) return null;
      return { subscribe: { kind: "application", id: app.id } };
    },
  });

// GET /api/public/check-in/:publicId/stream - header x-check-in-token
export const streamCheckInHandler = (req: Request, res: Response): Promise<void> =>
  openStream(req, res, {
    check: async () => {
      const publicId = String(req.params.publicId ?? "");
      const token = header(req, "x-check-in-token");
      if (!publicId || !token || publicId.length > 64 || token.length > 100) return null;
      const select = { id: true, status: true, expiresAt: true, viewTokenHash: true } as const;
      const row = await prisma.walkInCheckIn.findUnique({ where: { publicId }, select });
      if (!row || !tokenMatches(token, row.viewTokenHash)) return null;
      // Same rule as the JSON endpoint: a dismissed or lapsed check-in no longer works.
      const over = (r: { status: string; expiresAt: Date }) =>
        r.status === "DISMISSED" || (r.status === "PENDING" && r.expiresAt.getTime() <= Date.now());
      if (over(row)) return null;
      return {
        subscribe: { kind: "checkIn" as const, id: row.id },
        // Only a PENDING check-in lapses by time; CONFIRMED stays open for tracking.
        expiresAt: row.status === "PENDING" ? row.expiresAt : undefined,
        ends: async () => {
          const now = await prisma.walkInCheckIn.findUnique({ where: { publicId }, select });
          return !now || over(now);
        },
      };
    },
  });
