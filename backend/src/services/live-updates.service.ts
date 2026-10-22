import prisma from "../utils/prisma.js";
import { safeLogError } from "../security/errors.js";

// In-process hub: Heroku runs one web dyno, so one polling timer per process is enough.
// A second dyno would need a shared channel (Postgres LISTEN/NOTIFY or Redis) so a change seen by one dyno reaches streams on the other.

export type LiveKind = "application" | "checkIn";
export type LiveTarget = { kind: LiveKind; id: number };

const TICK_MS = 3000;

const subscribers = new Map<string, Set<() => void>>();
const versions = new Map<string, string>();
let timer: ReturnType<typeof setInterval> | null = null;
let ticking = false;

const keyOf = (target: LiveTarget) => `${target.kind}:${target.id}`;

const idsOf = (kind: LiveKind): number[] => {
  const ids: number[] = [];
  for (const key of subscribers.keys()) {
    const [k, id] = key.split(":");
    if (k === kind) ids.push(Number(id));
  }
  return ids;
};

const notify = (key: string, version: string) => {
  const previous = versions.get(key);
  versions.set(key, version);
  if (previous === undefined || previous === version) return;
  for (const onChange of [...(subscribers.get(key) ?? [])]) {
    try {
      onChange();
    } catch (error) {
      safeLogError("Live updates: subscriber callback", error);
    }
  }
};

const tick = async () => {
  if (ticking) return;
  ticking = true;
  try {
    const checkInIds = idsOf("checkIn");
    const appIds = new Set(idsOf("application"));
    const checkIns = checkInIds.length
      ? await prisma.walkInCheckIn.findMany({
          where: { id: { in: checkInIds } },
          select: { id: true, status: true, updatedAt: true, applicationId: true },
        })
      : [];
    for (const row of checkIns) if (row.applicationId) appIds.add(row.applicationId);

    const appVersions = new Map<number, string>();
    if (appIds.size) {
      const apps = await prisma.application.findMany({
        where: { id: { in: [...appIds] } },
        select: {
          id: true,
          status: true,
          updatedAt: true,
          interviews: { where: { isActive: true }, orderBy: { updatedAt: "desc" }, take: 1, select: { updatedAt: true } },
        },
      });
      for (const app of apps) {
        appVersions.set(app.id, `${app.updatedAt.getTime()}:${app.status}:${app.interviews[0]?.updatedAt.getTime() ?? 0}`);
      }
    }

    for (const id of idsOf("application")) notify(`application:${id}`, appVersions.get(id) ?? "missing");

    const seen = new Set<number>();
    for (const row of checkIns) {
      seen.add(row.id);
      const own = `${row.status}:${row.updatedAt.getTime()}:${row.applicationId ?? 0}`;
      const linked = row.applicationId ? appVersions.get(row.applicationId) ?? "missing" : "";
      notify(`checkIn:${row.id}`, `${own}|${linked}`);
    }
    for (const id of checkInIds) if (!seen.has(id)) notify(`checkIn:${id}`, "missing");
  } catch (error) {
    safeLogError("Live updates: poll", error);
  } finally {
    ticking = false;
  }
};

/** Calls onChange whenever the watched row changes. Returns an idempotent unsubscribe. */
export const subscribeLive = (target: LiveTarget, onChange: () => void): (() => void) => {
  const key = keyOf(target);
  let set = subscribers.get(key);
  if (!set) {
    set = new Set();
    subscribers.set(key, set);
  }
  set.add(onChange);
  if (!timer) {
    timer = setInterval(() => void tick(), TICK_MS);
    timer.unref?.();
  }

  let done = false;
  return () => {
    if (done) return;
    done = true;
    const current = subscribers.get(key);
    if (current) {
      current.delete(onChange);
      if (current.size === 0) {
        subscribers.delete(key);
        versions.delete(key);
      }
    }
    if (subscribers.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
      versions.clear();
    }
  };
};

export const __liveHubStats = () => ({
  subscribers: [...subscribers.values()].reduce((sum, set) => sum + set.size, 0),
  timerRunning: timer !== null,
});
