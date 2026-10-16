/**
 * Shared helpers for the production-preview performance harness.
 *
 * - Serves nothing itself: the dist directory is served by `vite preview` (see perf.config.ts).
 * - Routes every request in the browser context: preview-origin static files continue,
 *   every `/api/` request is answered from fixtures (fixtures.ts), everything else is aborted.
 * - Measures LCP, CLS, long tasks and Event Timing with PerformanceObserver (init script),
 *   and resource sizes from the Resource Timing API.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import type { Browser, BrowserContext, CDPSession, Page, Route } from "@playwright/test";
import { answerApi, SMALL_SCALE, SSE_PATH, type FixtureScale, type IdentityKey } from "./fixtures";

export const PREVIEW_ORIGIN = "http://127.0.0.1:4173";
export const PREVIEW_HOSTS = new Set(["127.0.0.1:4173", "localhost:4173"]);
export const VIEWPORT = { width: 1440, height: 900 } as const;
export const CPU_RATE = 4;
export const DEFAULT_DELAY_MS = 100;

/**
 * Opt-in network profile (env PERF_NETWORK=slow). Off by default, so default runs are unchanged.
 * - CDP Network.emulateNetworkConditions applies to requests that reach the network (preview-origin files).
 * - Routed API fixtures never touch the network, so each one also waits `latencyMs` plus its transfer time.
 */
export const SLOW_NETWORK = process.env.PERF_NETWORK === "slow";
export const SLOW_NETWORK_PROFILE = {
  latencyMs: 150,
  downloadBytesPerSec: 1_600_000 / 8,
  uploadBytesPerSec: 750_000 / 8,
} as const;

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
};

export interface NetLog {
  /** `/api/` requests that had no fixture. Should stay empty. */
  unexpectedApi: string[];
  /** Non-preview, non-API requests that were aborted (external hosts, other localhost ports). */
  blockedExternal: string[];
  /** `METHOD /path` -> number of requests answered. */
  apiCounts: Record<string, number>;
  /** `METHOD /path` -> bytes of the last fixture body served. */
  apiBytes: Record<string, number>;
  /** `METHOD /path` -> epoch ms when the last response was fulfilled (after any delay). */
  apiFulfilledAt: Record<string, number>;
}

export interface SessionOptions {
  identity?: IdentityKey;
  scale?: FixtureScale;
  /** Per-path fixture delays in ms, overriding the 100 ms default. */
  delays?: Record<string, number>;
  /** Default true. False skips the PerformanceObserver store (used by the memory investigation, which must not accumulate harness arrays). */
  observers?: boolean;
}

export interface Session {
  context: BrowserContext;
  page: Page;
  cdp: CDPSession;
  net: NetLog;
  errors: string[];
  close: () => Promise<void>;
}

export function newNetLog(): NetLog {
  return { unexpectedApi: [], blockedExternal: [], apiCounts: {}, apiBytes: {}, apiFulfilledAt: {} };
}

/** Runs in the page before any app script. Installs observers and optional auth state. */
function initScript(arg: { token: string | null; role: string | null; observers: boolean }) {
  if (arg.token) {
    try {
      localStorage.setItem("access_token", arg.token);
      if (arg.role) localStorage.setItem("user_role", arg.role);
    } catch {
      /* storage unavailable */
    }
  }
  if (!arg.observers) return;
  const w = window as unknown as { __perf?: Record<string, unknown> };
  try {
    performance.setResourceTimingBufferSize(4000);
  } catch {
    /* not supported */
  }
  const store = {
    lcp: [] as Array<{ start: number; size: number }>,
    cls: [] as Array<{ start: number; value: number; hadRecentInput: boolean; sources: unknown[] }>,
    longtasks: [] as Array<{ start: number; duration: number }>,
    events: [] as Array<{ name: string; start: number; duration: number; interactionId: number }>,
    mark: 0,
  };
  w.__perf = store;
  const observe = (type: string, extra: Record<string, unknown>, handler: (entries: PerformanceEntry[]) => void) => {
    try {
      new PerformanceObserver((list) => handler(list.getEntries())).observe({ type, buffered: true, ...extra } as PerformanceObserverInit);
    } catch {
      /* type unsupported */
    }
  };
  observe("largest-contentful-paint", {}, (entries) => {
    for (const e of entries as PerformanceEntry[]) store.lcp.push({ start: e.startTime, size: (e as unknown as { size: number }).size });
  });
  observe("layout-shift", {}, (entries) => {
    for (const e of entries as unknown as Array<{
      startTime: number;
      value: number;
      hadRecentInput: boolean;
      sources?: Array<{ node: Node | null; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }>;
    }>) {
      // LayoutShift attribution: which element moved, and from/to where (CSS px, viewport coordinates).
      const sources = (e.sources ?? []).map((s) => {
        const node = s.node && s.node.nodeType === 1 ? (s.node as Element) : null;
        return {
          node: node
            ? {
                tag: node.tagName.toLowerCase(),
                id: node.id || null,
                classes: (node.getAttribute("class") ?? "").split(/\s+/).filter(Boolean).slice(0, 4).join(" ") || null,
                text: (node.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 60),
              }
            : null,
          previous: { x: Math.round(s.previousRect.x), y: Math.round(s.previousRect.y), w: Math.round(s.previousRect.width), h: Math.round(s.previousRect.height) },
          current: { x: Math.round(s.currentRect.x), y: Math.round(s.currentRect.y), w: Math.round(s.currentRect.width), h: Math.round(s.currentRect.height) },
        };
      });
      store.cls.push({ start: e.startTime, value: e.value, hadRecentInput: e.hadRecentInput, sources });
    }
  });
  observe("longtask", {}, (entries) => {
    for (const e of entries) store.longtasks.push({ start: e.startTime, duration: e.duration });
  });
  observe("event", { durationThreshold: 16 }, (entries) => {
    for (const e of entries as unknown as Array<{ name: string; startTime: number; duration: number; interactionId: number }>) {
      store.events.push({ name: e.name, start: e.startTime, duration: e.duration, interactionId: e.interactionId });
    }
  });
}

async function fulfillJson(route: Route, status: number, data: unknown) {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: CORS_HEADERS,
    body: JSON.stringify(data),
  });
}

async function installRouting(
  context: BrowserContext,
  identity: IdentityKey,
  scale: FixtureScale,
  delays: Record<string, number>,
  net: NetLog,
) {
  const fixtureCtx = { identity, scale };
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (url.pathname.startsWith("/api/")) {
      if (method === "OPTIONS") {
        await route.fulfill({ status: 204, headers: CORS_HEADERS, body: "" });
        return;
      }
      const key = `${method} ${url.pathname}`;
      // Shape split: "[paged]" when the request carries page/pageSize, otherwise "[full]" (legacy complete list).
      const shapeKey = `${key} [${url.searchParams.has("page") || url.searchParams.has("pageSize") ? "paged" : "full"}]`;
      const delay = delays[url.pathname] ?? DEFAULT_DELAY_MS;
      await new Promise((resolve) => setTimeout(resolve, delay));
      net.apiCounts[key] = (net.apiCounts[key] ?? 0) + 1;
      net.apiCounts[shapeKey] = (net.apiCounts[shapeKey] ?? 0) + 1;

      if (SSE_PATH.test(url.pathname)) {
        await route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          headers: CORS_HEADERS,
          body: ": keepalive\n\n",
        });
        return;
      }

      const answer = answerApi(method, url, fixtureCtx);
      if (!answer) {
        if (!net.unexpectedApi.includes(key)) net.unexpectedApi.push(key);
        await fulfillJson(route, 404, { success: false, message: `No perf fixture for ${key}`, error: null });
        return;
      }
      net.apiBytes[key] = Buffer.byteLength(answer.body);
      net.apiBytes[shapeKey] = Buffer.byteLength(answer.body);
      if (SLOW_NETWORK) {
        // Stand-in for one round trip plus the body's download time on the emulated link.
        const transferMs = SLOW_NETWORK_PROFILE.latencyMs + (Buffer.byteLength(answer.body) / SLOW_NETWORK_PROFILE.downloadBytesPerSec) * 1000;
        await new Promise((resolve) => setTimeout(resolve, transferMs));
      }
      net.apiFulfilledAt[key] = Date.now();
      await route.fulfill({ status: answer.status, contentType: "application/json", headers: CORS_HEADERS, body: answer.body });
      return;
    }

    if (PREVIEW_HOSTS.has(url.host)) {
      await route.continue();
      return;
    }

    const label = `${url.origin}${url.pathname}`;
    if (!net.blockedExternal.includes(label)) net.blockedExternal.push(label);
    await route.abort("blockedbyclient");
  });
}

export async function openSession(browser: Browser, options: SessionOptions = {}): Promise<Session> {
  const identity = options.identity ?? "APPLICANT";
  const scale = options.scale ?? SMALL_SCALE;
  const context = await browser.newContext({
    viewport: { ...VIEWPORT },
    deviceScaleFactor: 1,
    locale: "en-US",
    timezoneId: "Asia/Manila",
    colorScheme: "light",
    serviceWorkers: "block",
  });
  const net = newNetLog();
  await context.addInitScript(initScript, {
    token: options.identity ? `perf-${identity.toLowerCase()}-token` : null,
    role: options.identity ?? null,
    observers: options.observers ?? true,
  });
  await installRouting(context, identity, scale, options.delays ?? {}, net);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text().slice(0, 240)}`);
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_RATE });
  if (SLOW_NETWORK) {
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: SLOW_NETWORK_PROFILE.latencyMs,
      downloadThroughput: SLOW_NETWORK_PROFILE.downloadBytesPerSec,
      uploadThroughput: SLOW_NETWORK_PROFILE.uploadBytesPerSec,
    });
  }
  return {
    context,
    page,
    cdp,
    net,
    errors,
    close: () => context.close(),
  };
}

/** Navigates, waits for the first visible heading, then holds the observation window. */
export async function gotoAndSettle(page: Page, urlPath: string, settleMs: number) {
  await page.goto(urlPath, { waitUntil: "load", timeout: 60_000 });
  await page.locator("h1, h2").first().waitFor({ state: "visible", timeout: 30_000 });
  const headingAt = await page.evaluate(() => performance.now());
  await page.waitForTimeout(settleMs);
  return headingAt;
}

/** `*Bytes` are transfer (encoded, possibly gzip) bytes; `*RawBytes` are uncompressed bytes. */
export interface ResourceMetrics {
  jsCount: number;
  jsBytes: number;
  jsRawBytes: number;
  jsFiles: string[];
  imageCount: number;
  imageBytes: number;
  imageRawBytes: number;
  imageFiles: string[];
  fontCount: number;
  fontBytes: number;
  fontRawBytes: number;
  fontFiles: string[];
}

export interface ClsSource {
  node: { tag: string; id: string | null; classes: string | null; text: string } | null;
  previous: { x: number; y: number; w: number; h: number };
  current: { x: number; y: number; w: number; h: number };
}

export interface ClsShift {
  start: number;
  value: number;
  sources: ClsSource[];
}

export interface PageMetrics extends ResourceMetrics {
  lcpMs: number | null;
  cls: number;
  clsAttribution: ClsShift[];
  longtaskCount: number;
  longtaskTotalMs: number;
  longtaskMaxMs: number;
  domNodes: number;
}

/**
 * Reads LCP, CLS, long tasks and resource totals. Every `.js` request counts,
 * including module preloads (Resource Timing reports them with initiatorType `link`).
 */
export async function collectMetrics(page: Page): Promise<PageMetrics> {
  return page.evaluate(() => {
    type Store = {
      lcp: Array<{ start: number }>;
      cls: Array<{ start: number; value: number; hadRecentInput: boolean; sources?: unknown[] }>;
      longtasks: Array<{ duration: number }>;
    };
    const store = (window as unknown as { __perf?: Store }).__perf ?? { lcp: [], cls: [], longtasks: [] };
    const pathOf = (name: string) => {
      try {
        return new URL(name).pathname;
      } catch {
        return name;
      }
    };
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const bucket = (test: (p: string) => boolean) => {
      const matched = resources.filter((entry) => test(pathOf(entry.name)));
      const bytes = matched.reduce((total, entry) => total + (entry.encodedBodySize || 0), 0);
      const rawBytes = matched.reduce((total, entry) => total + (entry.decodedBodySize || 0), 0);
      return {
        count: matched.length,
        bytes,
        rawBytes,
        files: matched.map((entry) => `${pathOf(entry.name)} enc=${entry.encodedBodySize || 0} raw=${entry.decodedBodySize || 0}`),
      };
    };
    const js = bucket((p) => /\.m?js$/i.test(p));
    const images = bucket((p) => /\.(png|jpe?g|gif|webp|avif|svg|ico)$/i.test(p));
    const fonts = bucket((p) => /\.(woff2?|ttf|otf|eot)$/i.test(p));
    const lastLcp = store.lcp.length ? store.lcp[store.lcp.length - 1].start : null;
    const cls = store.cls.filter((entry) => !entry.hadRecentInput).reduce((total, entry) => total + entry.value, 0);
    const longDurations = store.longtasks.map((entry) => entry.duration);
    return {
      jsCount: js.count,
      jsBytes: js.bytes,
      jsRawBytes: js.rawBytes,
      jsFiles: js.files,
      imageCount: images.count,
      imageBytes: images.bytes,
      imageRawBytes: images.rawBytes,
      imageFiles: images.files,
      fontCount: fonts.count,
      fontBytes: fonts.bytes,
      fontRawBytes: fonts.rawBytes,
      fontFiles: fonts.files,
      lcpMs: lastLcp === null ? null : Math.round(lastLcp),
      cls: Math.round(cls * 10000) / 10000,
      clsAttribution: store.cls
        .filter((entry) => !entry.hadRecentInput && entry.value > 0)
        .map((entry) => ({ start: Math.round(entry.start), value: Math.round(entry.value * 10000) / 10000, sources: entry.sources ?? [] })),
      longtaskCount: longDurations.length,
      longtaskTotalMs: Math.round(longDurations.reduce((t, d) => t + d, 0)),
      longtaskMaxMs: Math.round(longDurations.reduce((m, d) => Math.max(m, d), 0)),
      domNodes: document.getElementsByTagName("*").length,
    };
  });
}

/* ---------- Event Timing interactions ---------- */

export const CLICK_EVENTS = ["pointerdown", "pointerup", "mousedown", "mouseup", "click"];
export const KEY_EVENTS = ["keydown", "keypress", "keyup", "beforeinput", "input"];

export interface InteractionSample {
  /** Largest Event Timing duration among the action's entries; null when every entry was below 16 ms. */
  ms: number | null;
  /** Duration of the `click` entry alone. */
  clickMs: number | null;
  entries: number;
  byName: Record<string, number>;
}

/** Marks the start of an interaction. Entries starting before the mark are ignored. */
export async function markInteraction(page: Page) {
  await page.evaluate(() => {
    const store = (window as unknown as { __perf?: { mark: number } }).__perf;
    if (store) store.mark = performance.now();
  });
}

/** Reads Event Timing entries since the last mark, after the observer has delivered them. */
export async function readInteraction(page: Page, names: string[], settleMs = 250): Promise<InteractionSample> {
  await page.waitForTimeout(settleMs);
  const entries = await page.evaluate((wanted) => {
    const store = (window as unknown as { __perf?: { mark: number; events: Array<{ name: string; start: number; duration: number }> } }).__perf;
    if (!store) return [];
    return store.events.filter((e) => e.start >= store.mark - 1 && wanted.includes(e.name));
  }, names);
  const byName: Record<string, number> = {};
  for (const entry of entries) {
    byName[entry.name] = Math.max(byName[entry.name] ?? 0, Math.round(entry.duration));
  }
  const values = Object.values(byName);
  return {
    ms: values.length ? Math.max(...values) : null,
    clickMs: byName.click ?? null,
    entries: entries.length,
    byName,
  };
}

export interface Stats {
  samples: number;
  reported: number;
  belowThreshold: number;
  median: number | null;
  p95: number | null;
  p95LowerBound: number | null;
  min: number | null;
  max: number | null;
}

/** Nearest-rank percentile. */
function percentile(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1];
}

/**
 * Median and p95 over samples. A null sample means Event Timing reported nothing (below 16 ms),
 * so `median`/`p95` treat it as 16 ms (upper bound) and `p95LowerBound` treats it as 0 ms.
 */
export function statsOf(values: Array<number | null>): Stats {
  const reported = values.filter((v): v is number => v !== null);
  const upper = values.map((v) => (v === null ? 16 : v)).sort((a, b) => a - b);
  const lower = values.map((v) => (v === null ? 0 : v)).sort((a, b) => a - b);
  const median = upper.length
    ? upper.length % 2
      ? upper[(upper.length - 1) / 2]
      : (upper[upper.length / 2 - 1] + upper[upper.length / 2]) / 2
    : null;
  return {
    samples: values.length,
    reported: reported.length,
    belowThreshold: values.length - reported.length,
    median,
    p95: percentile(upper, 95),
    p95LowerBound: percentile(lower, 95),
    min: upper.length ? upper[0] : null,
    max: upper.length ? upper[upper.length - 1] : null,
  };
}

/** Median, min and max for run-to-run numbers (page loads). */
export function rangeOf(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return { median: null, min: null, max: null, values };
  const mid = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  return { median: mid, min: sorted[0], max: sorted[sorted.length - 1], values };
}

/* ---------- Output ---------- */

export function outputDir(label: string) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const dir = path.resolve(here, "..", "test-results", "perf", label);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function writeResult(dir: string, name: string, data: unknown) {
  writeFileSync(path.join(dir, `${name}.json`), `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

/* ---------- Dist bundle facts (no rebuild) ---------- */

/**
 * Initial JavaScript is the entry plus its modulepreload list in the built index.html.
 * Gzip uses Node's default level, matching frontend/scripts/measure-bundle.mjs.
 */
export function bundleFacts(distDir: string) {
  const html = readFileSync(path.join(distDir, "index.html"), "utf8");
  const scriptRefs = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((m) => m[1]);
  const preloadRefs = [...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+\.js)"/g)].map((m) => m[1]);
  const cssRefs = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+\.css)"/g)].map((m) => m[1]);
  const initialJs = [...new Set([...scriptRefs, ...preloadRefs])];
  const read = (ref: string) => readFileSync(path.join(distDir, ref.replace(/^\//, "")));
  const jsRaw = initialJs.reduce((total, ref) => total + read(ref).byteLength, 0);
  const jsGzip = initialJs.reduce((total, ref) => total + gzipSync(read(ref)).byteLength, 0);
  const cssRaw = cssRefs.reduce((total, ref) => total + read(ref).byteLength, 0);
  const cssGzip = cssRefs.reduce((total, ref) => total + gzipSync(read(ref)).byteLength, 0);
  const assetsDir = path.join(distDir, "assets");
  const allJs = readdirSync(assetsDir).filter((f) => f.endsWith(".js"));
  return {
    distDir,
    initialJsChunks: initialJs.length,
    initialJsRawBytes: jsRaw,
    initialJsGzipBytes: jsGzip,
    initialJsGzipBudgetBytes: 200_000,
    initialJsFiles: initialJs,
    mainCssRawBytes: cssRaw,
    mainCssGzipBytes: cssGzip,
    distJsFileCount: allJs.length,
  };
}

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} before running the perf harness (see frontend/perf/README.md).`);
  return value;
}
