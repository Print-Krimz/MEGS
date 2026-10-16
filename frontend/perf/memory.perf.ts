/**
 * P12 memory investigation: applicant dashboard <-> Explore Jobs SPA navigation, N cycles.
 *
 * Run from frontend/ against a built dist (never rebuilds):
 *   PERF_MEMORY=1 PERF_DIST=<dist> PERF_LABEL=<label> npx playwright test -c perf/perf.config.ts
 *
 * - Navigation is by clicking the applicant nav links, not page.goto (the first load uses goto).
 * - Harness PerformanceObserver stores are off (observers: false) so they do not grow with navigation.
 * - The only page-side addition is a timer counter (TIMER_SCRIPT): it keeps the set of live timer ids, no history.
 * - Checkpoints (cycles 0, 20, 40, 60, 80, 100): forced GC twice, then heap usage, DOM counters,
 *   window/document listeners, React Query cache entries (found through the React fiber tree), node counts,
 *   and history length. Heap snapshots at cycle 20 (warm-up) and the final cycle.
 * - Output: frontend/test-results/perf/memory/<label>.json and <label>-cycleNNN.heapsnapshot.
 */
import { test, type CDPSession, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SMALL_SCALE } from "./fixtures";
import { gotoAndSettle, openSession, requiredEnv, type Session } from "./harness";

const here = path.dirname(fileURLToPath(import.meta.url));
const DIST = requiredEnv("PERF_DIST");
const LABEL = process.env.PERF_LABEL ?? "memory";
const CYCLES = Number(process.env.PERF_MEMORY_CYCLES ?? 100);
/** Every 20 cycles up to CYCLES (0, 20, ..., 100 for the default run). */
const CHECKPOINTS = Array.from({ length: Math.floor(CYCLES / 20) + 1 }, (_, i) => i * 20);
const SNAPSHOT_CYCLES = new Set([20, CYCLES]);
/** Wait after each route change so queued fixture responses (100 ms each) and renders complete. */
const SETTLE_MS = 800;
const NAV_TIMEOUT_MS = 30_000;
const MEM_DIR = path.resolve(here, "..", "test-results", "perf", "memory");
const OBJECT_GROUP = "perf-memory";

/** Counts live setTimeout/setInterval ids. Stores ids only and removes them when they fire or are cleared. */
const TIMER_SCRIPT = `(() => {
  const timeouts = new Set();
  const intervals = new Set();
  const st = window.setTimeout, ct = window.clearTimeout, si = window.setInterval, ci = window.clearInterval;
  window.setTimeout = function (fn, ms, ...rest) {
    if (typeof fn !== "function") return st.call(window, fn, ms, ...rest);
    const id = st.call(window, function (...args) { timeouts.delete(id); return fn.apply(this, args); }, ms, ...rest);
    timeouts.add(id);
    return id;
  };
  window.clearTimeout = function (id) { timeouts.delete(id); return ct.call(window, id); };
  window.setInterval = function (fn, ms, ...rest) {
    if (typeof fn !== "function") return si.call(window, fn, ms, ...rest);
    const id = si.call(window, fn, ms, ...rest);
    intervals.add(id);
    return id;
  };
  window.clearInterval = function (id) { intervals.delete(id); return ci.call(window, id); };
  window.__perfTimers = () => ({ liveTimeouts: timeouts.size, liveIntervals: intervals.size });
})();`;

/** Runs in the page. Returns DOM, history and React Query cache facts. Must be self-contained. */
function pageInternals() {
  type Fiber = { child: Fiber | null; sibling: Fiber | null; memoizedProps: unknown };
  type QueryLike = { queryHash: string; state: { status: string; data: unknown }; getObserversCount: () => number };
  type ClientLike = {
    getQueryCache: () => { getAll: () => QueryLike[] };
    getMutationCache: () => { getAll: () => unknown[] };
    getDefaultOptions: () => { queries?: { gcTime?: number } };
  };
  const out: Record<string, unknown> = {
    domElements: document.getElementsByTagName("*").length,
    historyLength: history.length,
    timers: (window as unknown as { __perfTimers?: () => unknown }).__perfTimers?.() ?? null,
  };
  try {
    const candidates = [document.getElementById("root"), ...Array.from(document.body.children)].filter(Boolean) as HTMLElement[];
    let rootFiber: Fiber | null = null;
    for (const el of candidates) {
      const key = Object.keys(el).find((k) => k.startsWith("__reactContainer$"));
      if (key) {
        rootFiber = (el as unknown as Record<string, Fiber>)[key];
        break;
      }
    }
    let client: ClientLike | null = null;
    const stack: Fiber[] = rootFiber ? [rootFiber] : [];
    let visited = 0;
    while (stack.length && !client) {
      const fiber = stack.pop() as Fiber;
      visited += 1;
      const value = (fiber.memoizedProps as { value?: unknown } | null)?.value as Partial<ClientLike> | undefined;
      if (value && typeof value.getQueryCache === "function") {
        client = value as ClientLike;
        break;
      }
      if (fiber.sibling) stack.push(fiber.sibling);
      if (fiber.child) stack.push(fiber.child);
    }
    if (!client) {
      out.queryClient = "not found";
    } else {
      const queries = client.getQueryCache().getAll();
      const byStatus: Record<string, number> = {};
      for (const q of queries) byStatus[q.state.status] = (byStatus[q.state.status] ?? 0) + 1;
      let dataBytes = 0;
      for (const q of queries) {
        try {
          dataBytes += JSON.stringify(q.state.data ?? null)?.length ?? 0;
        } catch {
          /* not serialisable */
        }
      }
      out.queryClient = {
        entries: queries.length,
        entriesWithObservers: queries.filter((q) => q.getObserversCount() > 0).length,
        byStatus,
        dataJsonChars: dataBytes,
        mutationEntries: client.getMutationCache().getAll().length,
        gcTimeMs: client.getDefaultOptions().queries?.gcTime ?? null,
        fiberNodesVisited: visited,
      };
    }
  } catch (error) {
    out.queryClientError = String(error);
  }
  return out;
}

/** Event listener totals on window and document (DOMDebugger, by type). */
async function listenerCounts(cdp: CDPSession) {
  const result: Record<string, unknown> = {};
  for (const expression of ["window", "document"]) {
    const evaluated = await cdp.send("Runtime.evaluate", { expression, objectGroup: OBJECT_GROUP });
    const objectId = evaluated.result.objectId;
    if (!objectId) {
      result[expression] = null;
      continue;
    }
    const { listeners } = await cdp.send("DOMDebugger.getEventListeners", { objectId, depth: 0 });
    const byType: Record<string, number> = {};
    for (const listener of listeners) byType[listener.type] = (byType[listener.type] ?? 0) + 1;
    result[expression] = { total: listeners.length, byType };
  }
  await cdp.send("Runtime.releaseObjectGroup", { objectGroup: OBJECT_GROUP });
  return result;
}

/** Streams a V8 heap snapshot to disk. takeHeapSnapshot runs its own full GC first. */
async function takeSnapshot(cdp: CDPSession, file: string) {
  const parts: string[] = [];
  const onChunk = (event: { chunk: string }) => {
    parts.push(event.chunk);
  };
  cdp.on("HeapProfiler.addHeapSnapshotChunk", onChunk);
  try {
    await cdp.send("HeapProfiler.takeHeapSnapshot", { reportProgress: false });
  } finally {
    cdp.off("HeapProfiler.addHeapSnapshotChunk", onChunk);
  }
  const text = parts.join("");
  writeFileSync(file, text, "utf8");
  return { file, bytes: Buffer.byteLength(text) };
}

async function checkpoint(session: Session, cycle: number, snapshotFile: string | null) {
  const { cdp, page } = session;
  await cdp.send("HeapProfiler.collectGarbage");
  await cdp.send("HeapProfiler.collectGarbage");
  const heap = await cdp.send("Runtime.getHeapUsage");
  const perfMemory = await page.evaluate(() => {
    const m = (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
    return m ? { usedJSHeapSize: m.usedJSHeapSize, totalJSHeapSize: m.totalJSHeapSize, jsHeapSizeLimit: m.jsHeapSizeLimit } : null;
  });
  const dom = await cdp.send("Memory.getDOMCounters");
  const listeners = await listenerCounts(cdp);
  const internals = await page.evaluate(pageInternals);
  const snapshot = snapshotFile ? await takeSnapshot(cdp, snapshotFile) : null;
  return {
    cycle,
    at: new Date().toISOString(),
    heapUsedBytes: heap.usedSize,
    heapTotalBytes: heap.totalSize,
    embedderHeapUsedBytes: heap.embedderHeapUsedSize,
    perfMemory,
    dom: { documents: dom.documents, nodes: dom.nodes, jsEventListeners: dom.jsEventListeners },
    listeners,
    internals,
    snapshot,
    pageErrors: session.errors.length,
    unexpectedApi: session.net.unexpectedApi,
  };
}

/** One cycle half: click a nav link (no page.goto), wait for the URL, then let the page settle. */
async function navigate(page: Page, linkName: string, pathname: string) {
  await page.getByRole("navigation", { name: "Main Applicant Navigation" }).getByRole("link", { name: linkName, exact: true }).click();
  await page.waitForURL((url) => url.pathname === pathname, { timeout: NAV_TIMEOUT_MS });
  await page.waitForTimeout(SETTLE_MS);
}

function pct(from: number | undefined, to: number | undefined) {
  if (!from || to === undefined) return null;
  return Math.round(((to - from) / from) * 10000) / 100;
}

test.describe("P12 memory investigation", () => {
  test(`applicant dashboard <-> Explore Jobs, ${CYCLES} cycles`, async ({ browser }) => {
    test.setTimeout(40 * 60_000);
    mkdirSync(MEM_DIR, { recursive: true });
    const session = await openSession(browser, { identity: "APPLICANT", scale: SMALL_SCALE, observers: false });
    await session.context.addInitScript(TIMER_SCRIPT);
    const checkpoints: Array<Record<string, unknown>> = [];
    const started = Date.now();
    let error: string | null = null;
    try {
      await gotoAndSettle(session.page, "/app", 1000);
      for (let cycle = 0; cycle <= CYCLES; cycle += 1) {
        if (cycle > 0) {
          await navigate(session.page, "Explore Jobs", "/app/jobs");
          await navigate(session.page, "Dashboard", "/app");
        }
        if (CHECKPOINTS.includes(cycle)) {
          const file = SNAPSHOT_CYCLES.has(cycle) ? path.join(MEM_DIR, `${LABEL}-cycle${String(cycle).padStart(3, "0")}.heapsnapshot`) : null;
          const row = await checkpoint(session, cycle, file);
          checkpoints.push(row);
          console.log(`[perf-memory] cycle ${cycle}: heapUsed=${row.heapUsedBytes} nodes=${(row.dom as { nodes: number }).nodes}`);
        } else if (cycle % 10 === 0) {
          console.log(`[perf-memory] cycle ${cycle}`);
        }
      }
    } catch (caught) {
      error = caught instanceof Error ? caught.message.split("\n")[0] : String(caught);
      console.error(`[perf-memory] stopped at error: ${error}`);
    } finally {
      const byCycle = (c: number) => checkpoints.find((row) => row.cycle === c) as Record<string, any> | undefined;
      const a = byCycle(20);
      const b = byCycle(CYCLES);
      const growth = {
        fromCycle: 20,
        toCycle: CYCLES,
        postGcHeapUsedPct: pct(a?.heapUsedBytes, b?.heapUsedBytes),
        perfMemoryUsedPct: pct(a?.perfMemory?.usedJSHeapSize, b?.perfMemory?.usedJSHeapSize),
        domNodesPct: pct(a?.dom?.nodes, b?.dom?.nodes),
        domNodesDelta: a && b ? b.dom.nodes - a.dom.nodes : null,
        listenersWindowDelta: a && b ? b.listeners.window?.total - a.listeners.window?.total : null,
        listenersDocumentDelta: a && b ? b.listeners.document?.total - a.listeners.document?.total : null,
        jsEventListenersDelta: a && b ? b.dom.jsEventListeners - a.dom.jsEventListeners : null,
        queryEntriesDelta: a && b ? (b.internals?.queryClient?.entries ?? NaN) - (a.internals?.queryClient?.entries ?? NaN) : null,
        liveTimersDelta: a && b ? (b.internals?.timers?.liveTimeouts ?? NaN) + (b.internals?.timers?.liveIntervals ?? NaN) - ((a.internals?.timers?.liveTimeouts ?? NaN) + (a.internals?.timers?.liveIntervals ?? NaN)) : null,
      };
      const result = {
        scenario: "applicant dashboard <-> Explore Jobs via nav links; forced GC x2 at each checkpoint; SMALL fixtures; CPU 4x",
        label: LABEL,
        dist: DIST,
        cycles: CYCLES,
        settleMsPerNavigation: SETTLE_MS,
        observers: false,
        error,
        durationMs: Date.now() - started,
        growth,
        checkpoints,
        pageErrors: session.errors.slice(0, 10),
        unexpectedApi: session.net.unexpectedApi,
        blockedExternal: session.net.blockedExternal.length,
      };
      writeFileSync(path.join(MEM_DIR, `${LABEL}.json`), `${JSON.stringify(result, null, 2)}\n`, "utf8");
      console.log(`[perf-memory] wrote ${path.join(MEM_DIR, `${LABEL}.json`)}`);
      await session.close();
      if (error) throw new Error(`partial run written (${checkpoints.length} checkpoints): ${error}`);
    }
  });
});
