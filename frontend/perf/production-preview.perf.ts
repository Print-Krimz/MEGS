/**
 * Production-preview performance baseline and repeat runs.
 *
 * Run from frontend/:
 *   PERF_DIST=<dist> PERF_LABEL=baseline npx playwright test -c perf/perf.config.ts
 *
 * Writes frontend/test-results/perf/<label>/*.json and summary.json.
 * Required scenarios fail the run (and are recorded as {"failed": "<reason>"}) on any exception,
 * unexpected API request, page or console error, missing metric, or initial JS over budget.
 * Only probes registered with `optional()` may be skipped, and they are recorded as
 * {"optional": true, "skipped": "<reason>"} so they stay distinguishable. No values are invented.
 */
import { test, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import path from "node:path";
import { fixtureBytes, LARGE_SCALE, SMALL_SCALE, type IdentityKey } from "./fixtures";
import {
  assertBundleBudget,
  assertCleanSession,
  assertMetrics,
  bundleFacts,
  CLICK_EVENTS,
  CPU_RATE,
  collectMetrics,
  gotoAndSettle,
  KEY_EVENTS,
  markInteraction,
  openSession,
  outputDir,
  rangeOf,
  readInteraction,
  readyHeadingFor,
  requiredEnv,
  SLOW_NETWORK,
  SLOW_NETWORK_PROFILE,
  statsOf,
  VIEWPORT,
  writeResult,
  type PageMetrics,
  type Session,
} from "./harness";

const DIST = requiredEnv("PERF_DIST");
const LABEL = process.env.PERF_LABEL ?? "baseline";
const OUT = outputDir(LABEL);
const ROUTE_RUNS = 5;

const summary: Record<string, unknown> = {
  label: LABEL,
  generatedAt: new Date().toISOString(),
  dist: DIST,
  node: process.version,
  environment: {
    viewport: VIEWPORT,
    cpuThrottleRate: CPU_RATE,
    network: "localhost, unthrottled; fixtures answer after 100 ms unless a probe overrides it",
    browser: "Playwright-managed Chromium, headless",
  },
};

function persist(name: string, value: unknown) {
  writeResult(OUT, name, value);
  summary[name] = summarizeForSummary(name, value);
}

/** Keeps summary.json concise: raw sample arrays stay in the per-scenario file. */
function summarizeForSummary(name: string, value: unknown) {
  if (name === "routes" && value && typeof value === "object" && "routes" in value) {
    return (value as { routes: Array<{ path: string; summary: unknown }> }).routes.map((r) => ({ path: r.path, ...(r.summary as object) }));
  }
  return value;
}

/** Scenarios that must produce evidence. Optional probes are tracked separately. */
const requiredRan = new Set<string>();
const optionalSkipped = new Set<string>();

/** Runs a required scenario. Any error is recorded as {"failed": ...} and rethrown so the test fails. */
async function required(name: string, body: () => Promise<void>) {
  requiredRan.add(name);
  try {
    await body();
  } catch (error) {
    const reason = error instanceof Error ? error.message.split("\n")[0] : String(error);
    console.error(`[perf] ${name} FAILED: ${reason}`);
    persist(name, { failed: reason });
    throw error;
  }
}

/** Marks an explicitly optional probe as not run. It never counts as a pass of a required check. */
function optional(name: string, reason: string) {
  optionalSkipped.add(name);
  summary[name] = { optional: true, skipped: reason };
}

function writeSummary() {
  writeFileSync(path.join(OUT, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
}

/** When a fixture response was fulfilled, ms since t0 (null when that endpoint was not requested). */
function fulfilledAfter(session: Session, key: string, t0: number): number | null {
  const at = session.net.apiFulfilledAt[key];
  return at === undefined ? null : at - t0;
}

/** Waits until the body text includes `text`; returns ms since `t0` (Node clock). */
async function waitForTextAt(page: Page, text: string, t0: number) {
  // textContent, not innerText: innerText applies CSS text-transform (uppercase labels) and would miss these.
  await page.waitForFunction((wanted) => (document.body.textContent ?? "").includes(wanted), text, { timeout: 30_000, polling: "raf" });
  return Date.now() - t0;
}

function runSummary(runs: PageMetrics[]) {
  return {
    lcpMs: rangeOf(runs.map((r) => r.lcpMs).filter((v): v is number => v !== null)),
    cls: rangeOf(runs.map((r) => r.cls)),
    longtaskCount: rangeOf(runs.map((r) => r.longtaskCount)),
    longtaskTotalMs: rangeOf(runs.map((r) => r.longtaskTotalMs)),
    jsCount: rangeOf(runs.map((r) => r.jsCount)),
    jsTransferBytes: rangeOf(runs.map((r) => r.jsBytes)),
    jsRawBytes: rangeOf(runs.map((r) => r.jsRawBytes)),
    imageBytes: rangeOf(runs.map((r) => r.imageBytes)),
    fontBytes: rangeOf(runs.map((r) => r.fontBytes)),
  };
}

test.describe.serial("production-preview performance baseline", () => {
  test("bundle facts from dist index.html", async () => {
    test.setTimeout(60_000);
    await required("bundle", async () => {
      const facts = bundleFacts(DIST);
      persist("bundle", facts);
      assertBundleBudget(facts);
    });
  });

  test("route baseline: 10 routes, 5 fresh contexts each", async ({ browser }) => {
    test.setTimeout(45 * 60_000);
    const routes: Array<{ path: string; identity: IdentityKey | null }> = [
      { path: "/", identity: null },
      { path: "/app", identity: "APPLICANT" },
      { path: "/app/jobs", identity: "APPLICANT" },
      { path: "/app/profile", identity: "APPLICANT" },
      { path: "/ta", identity: "TALENT_ACQUISITION" },
      { path: "/ta/applications", identity: "TALENT_ACQUISITION" },
      { path: "/ta/mrfs", identity: "TALENT_ACQUISITION" },
      { path: "/ta/workforce", identity: "TALENT_ACQUISITION" },
      { path: "/admin", identity: "ADMINISTRATOR" },
      { path: "/admin/users", identity: "ADMINISTRATOR" },
    ];
    const results: Array<Record<string, unknown>> = [];
    const failures: string[] = [];
    // PERF_ROUTES=/ta,/app limits the route baseline to a subset (used for targeted re-checks).
    const only = process.env.PERF_ROUTES?.split(",").map((p) => p.trim()).filter(Boolean);
    const selected = only ? routes.filter((route) => only.includes(route.path)) : routes;
    if (!selected.length) throw new Error(`PERF_ROUTES=${process.env.PERF_ROUTES} matches no probed route.`);
    requiredRan.add("routes");
    for (const route of selected) {
      const runs: PageMetrics[] = [];
      const perRun: Array<Record<string, unknown>> = [];
      for (let run = 1; run <= ROUTE_RUNS; run += 1) {
        const session: Session = await openSession(browser, { identity: route.identity ?? undefined, scale: SMALL_SCALE });
        try {
          const headingMs = await gotoAndSettle(session.page, route.path, 1200);
          const metrics = await collectMetrics(session.page);
          try {
            assertMetrics(metrics, `${route.path} run ${run}`);
            assertCleanSession(session, `${route.path} run ${run}`);
          } catch (error) {
            failures.push(error instanceof Error ? error.message : String(error));
          }
          runs.push(metrics);
          perRun.push({
            run,
            headingMs: Math.round(headingMs),
            ...metrics,
            unexpectedApi: session.net.unexpectedApi,
            blockedExternal: session.net.blockedExternal.length,
            pageErrors: session.errors.length,
            errorSample: session.errors.slice(0, 3),
          });
        } finally {
          await session.close();
        }
      }
      results.push({
        path: route.path,
        identity: route.identity ?? "anonymous",
        runs: perRun,
        summary: runSummary(runs),
        unexpectedApiAcrossRuns: [...new Set(perRun.flatMap((r) => r.unexpectedApi as string[]))],
      });
      console.log(`[perf] ${route.path} done`);
    }
    persist("routes", {
      scenario: "route baseline; 1,200 ms observation window after the route's own visible h1; SMALL fixtures",
      routes: results,
      failures,
    });
    if (failures.length) throw new Error(`route baseline: ${failures.length} failing run(s); first: ${failures[0]}`);
  });

  test("landing: deferred and lazy assets after settling", async ({ browser }) => {
    test.setTimeout(20 * 60_000);
    await required("landing", async () => {
      const variants = [
        { name: "settled10s", scroll: false, settleMs: 10_000 },
        { name: "scrolledThenSettled", scroll: true, settleMs: 2_000 },
      ];
      const output: Record<string, unknown> = {};
      for (const variant of variants) {
        const runs: Array<Record<string, unknown>> = [];
        for (let run = 1; run <= ROUTE_RUNS; run += 1) {
          const session = await openSession(browser, {});
          try {
            await gotoAndSettle(session.page, "/", 0);
            if (variant.scroll) {
              for (let step = 0; step < 10; step += 1) {
                await session.page.mouse.wheel(0, 900);
                await session.page.waitForTimeout(250);
              }
            }
            await session.page.waitForTimeout(variant.settleMs);
            await session.page.evaluate(() => document.fonts.ready.then(() => true));
            const iconHref = await session.page.evaluate(() => (document.querySelector('link[rel~="icon"]') as HTMLLinkElement | null)?.href ?? null);
            const favicon = iconHref ? await session.page.request.get(iconHref).then(async (r) => (await r.body()).byteLength) : 0;
            const metrics = await collectMetrics(session.page);
            assertMetrics(metrics, `landing ${variant.name} run ${run}`);
            assertCleanSession(session, `landing ${variant.name} run ${run}`);
            runs.push({
              run,
              ...metrics,
              faviconBytes: favicon,
              imageBytesWithFavicon: metrics.imageBytes + favicon,
              unexpectedApi: session.net.unexpectedApi,
              blockedExternal: session.net.blockedExternal,
              pageErrors: session.errors.length,
            });
          } finally {
            await session.close();
          }
        }
        output[variant.name] = {
          runs,
          imageBytesWithFavicon: rangeOf(runs.map((r) => r.imageBytesWithFavicon as number)),
          fontBytes: rangeOf(runs.map((r) => r.fontBytes as number)),
          jsTransferBytes: rangeOf(runs.map((r) => r.jsBytes as number)),
          jsRawBytes: rangeOf(runs.map((r) => r.jsRawBytes as number)),
          imageFiles: runs[0]?.imageFiles,
          fontFiles: runs[0]?.fontFiles,
        };
      }
      persist("landing", { scenario: "anonymous landing at 1440x900, CPU 4x", variants: output });
    });
  });

  test("applicant address picker: Manila barangay ComboBox", async ({ browser }) => {
    test.setTimeout(20 * 60_000);
    await required("address-picker", async () => {
      const session = await openSession(browser, { identity: "APPLICANT", scale: SMALL_SCALE });
      const page = session.page;
      try {
        await gotoAndSettle(page, "/app/profile", 800);
        // Personal Info is a separate profile tab; the address fields live in its "Contact and address" disclosure.
        await page.getByRole("tab", { name: "Personal Info" }).click();
        // The disclosure body (and its id) renders only while open, so open it via its toggle if it is collapsed.
        const toggle = page.locator('button[aria-controls="profile-personal-contact"]');
        await toggle.waitFor({ state: "visible", timeout: 30_000 });
        if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
        const section = page.locator("#profile-personal-contact");
        await section.waitFor({ state: "attached", timeout: 15_000 });
        const province = section.getByRole("combobox", { name: /Province or region/i });
        await province.waitFor({ state: "visible", timeout: 15_000 });
        await province.click();
        await page.keyboard.type("Metro Manila");
        await page.waitForTimeout(200);
        await page.keyboard.press("Enter");
        const city = section.getByRole("combobox", { name: /City or municipality/i });
        await city.click();
        await page.keyboard.type("Manila");
        await page.waitForTimeout(200);
        await page.keyboard.press("Enter");
        const barangay = section.getByRole("combobox", { name: /Barangay/i });
        await barangay.waitFor({ state: "visible", timeout: 15_000 });
        for (let i = 0; i < 50 && !(await barangay.isEnabled()); i += 1) await page.waitForTimeout(100);
        const selectedCity = await city.inputValue();
        if (selectedCity !== "Manila") throw new Error(`city selection failed; input shows "${selectedCity}"`);

        const openClickMs: Array<number | null> = [];
        const openClickInteraction: Array<number | null> = [];
        const mounted: number[] = [];
        const expanded: boolean[] = [];
        for (let i = 0; i < 20; i += 1) {
          if (i > 0) {
            await page.keyboard.press("Escape");
            await page.waitForTimeout(200);
          }
          await markInteraction(page);
          await barangay.click();
          const sample = await readInteraction(page, CLICK_EVENTS, 300);
          mounted.push(await page.locator('[role="listbox"] [role="option"]').count());
          expanded.push((await barangay.getAttribute("aria-expanded")) === "true");
          openClickInteraction.push(sample.ms);
          openClickMs.push(sample.clickMs);
        }

        const typedSamples: Array<number | null> = [];
        for (const character of "bagumbayan") {
          await markInteraction(page);
          await page.keyboard.type(character);
          typedSamples.push((await readInteraction(page, KEY_EVENTS, 200)).ms);
        }
        const typedValue = await barangay.inputValue();
        if (!mounted.some((count) => count > 0)) throw new Error("barangay listbox never mounted an option");
        if (!expanded.every(Boolean)) throw new Error("barangay ComboBox did not expand after every click");

        const arrowSamples: Array<number | null> = [];
        for (let i = 0; i < 12; i += 1) {
          await markInteraction(page);
          await page.keyboard.press("ArrowDown");
          arrowSamples.push((await readInteraction(page, KEY_EVENTS, 200)).ms);
        }
        await page.keyboard.press("Escape");
        assertCleanSession(session, "address-picker");

        persist("address-picker", {
          scenario: "Applicant profile, Metro Manila > Manila, barangay ComboBox (CPU 4x)",
          selection: { province: "Metro Manila (NCR)", city: selectedCity },
          mountedOptionsOnOpen: rangeOf(mounted),
          expandedAfterEachClick: expanded.every(Boolean),
          openClick: {
            interaction: statsOf(openClickInteraction),
            clickEntryOnly: statsOf(openClickMs),
            interactionSamplesMs: openClickInteraction,
          },
          typing: { ...statsOf(typedSamples), sampleMs: typedSamples, valueAfterTyping: typedValue },
          arrowDown: { ...statsOf(arrowSamples), sampleMs: arrowSamples },
          pageErrors: session.errors.slice(0, 5),
          unexpectedApi: session.net.unexpectedApi,
        });
      } catch (error) {
        await page.screenshot({ path: path.join(OUT, "address-picker-failure.png") }).catch(() => undefined);
        throw error;
      } finally {
        await session.close();
      }
    });
  });

  test("MRF search keystrokes with 1,000 requests", async ({ browser }) => {
    test.setTimeout(20 * 60_000);
    await required("mrf-search", async () => {
      const session = await openSession(browser, { identity: "TALENT_ACQUISITION", scale: LARGE_SCALE });
      const page = session.page;
      try {
        await gotoAndSettle(page, "/ta/mrfs", 1500);
        const search = page.getByPlaceholder("Search by title or client");
        await search.click();
        const text = "Sales Associate Request 04";
        const keySamples: Array<number | null> = [];
        for (const character of text) {
          await markInteraction(page);
          await page.keyboard.type(character);
          keySamples.push((await readInteraction(page, KEY_EVENTS, 200)).ms);
        }
        const typed = await search.inputValue();
        if (typed !== text) throw new Error(`MRF search typed "${typed}", expected "${text}"`);
        assertCleanSession(session, "mrf-search");
        persist("mrf-search", {
          scenario: "/ta/mrfs, 1,000 MRF records, typing into the search box (CPU 4x)",
          keystrokes: text.length,
          valueMatches: typed === text,
          keystrokeMs: statsOf(keySamples),
          sampleMs: keySamples,
          pageErrors: session.errors.slice(0, 5),
        });
      } finally {
        await session.close();
      }
    });
  });

  test("admin analytics tab switches with 1,000 rows and 24 recruiters", async ({ browser }) => {
    test.setTimeout(20 * 60_000);
    await required("admin-analytics", async () => {
      const session = await openSession(browser, { identity: "ADMINISTRATOR", scale: LARGE_SCALE });
      const page = session.page;
      try {
        await gotoAndSettle(page, "/admin/analytics", 1500);
        const labels = ["Waiting", "Client requests", "Recruiters"];
        const tab = (label: string) => page.getByRole("tab", { name: new RegExp(`^${label}`) });
        const samples: Array<number | null> = [];
        const clickSamples: Array<number | null> = [];
        const selectedOk: boolean[] = [];
        for (let i = 0; i < 20; i += 1) {
          const label = labels[i % labels.length];
          await markInteraction(page);
          await tab(label).click();
          const sample = await readInteraction(page, CLICK_EVENTS, 300);
          samples.push(sample.ms);
          clickSamples.push(sample.clickMs);
          selectedOk.push((await tab(label).getAttribute("aria-selected")) === "true");
        }
        if (!selectedOk.every(Boolean)) throw new Error("an Admin Reports tab was not selected after its click");
        assertCleanSession(session, "admin-analytics");
        persist("admin-analytics", {
          scenario: "/admin/analytics with 1,000 request rows and 24 recruiters; 20 tab clicks (CPU 4x)",
          tabCount: labels.length,
          selectedAfterClick: selectedOk.every(Boolean),
          tabClickMs: statsOf(samples),
          clickEntryMs: statsOf(clickSamples),
          sampleMs: samples,
          domNodes: await page.evaluate(() => document.getElementsByTagName("*").length),
          pageErrors: session.errors.slice(0, 5),
          unexpectedApi: session.net.unexpectedApi,
        });
      } finally {
        await session.close();
      }
    });
  });

  test("TA dashboard: delayed interview-compliance endpoint", async ({ browser }) => {
    test.setTimeout(20 * 60_000);
    await required("ta-dashboard-delay", async () => {
      const runs: Array<Record<string, unknown>> = [];
      for (let run = 1; run <= ROUTE_RUNS; run += 1) {
        const session = await openSession(browser, {
          identity: "TALENT_ACQUISITION",
          scale: SMALL_SCALE,
          delays: { "/api/ta/compliance/interviews": 2000 },
        });
        const page = session.page;
        try {
          const t0 = Date.now();
          await page.goto("/ta", { waitUntil: "load" });
          await page.locator("h1").filter({ hasText: readyHeadingFor("/ta") }).first().waitFor({ state: "visible", timeout: 30_000 });
          const headingAt = Date.now() - t0;
          const pipelineAt = await waitForTextAt(page, "Hiring pipeline", t0);
          const openingsAt = await waitForTextAt(page, "Active job openings", t0);
          const complianceBannerAt = await waitForTextAt(page, "7 days after the interview is scheduled", t0);
          await page.waitForTimeout(1500);
          // Read only after the delayed response has been fulfilled (fulfilment is stamped after the delay).
          for (let waited = 0; session.net.apiFulfilledAt["GET /api/ta/compliance/interviews"] === undefined && waited < 10_000; waited += 100) await page.waitForTimeout(100);
          if (session.net.apiFulfilledAt["GET /api/ta/compliance/interviews"] === undefined) throw new Error("delayed compliance endpoint was never fulfilled");
          const complianceFulfilledAt = session.net.apiFulfilledAt["GET /api/ta/compliance/interviews"] - t0;
          const metrics = await collectMetrics(page);
          assertMetrics(metrics, `ta-dashboard-delay run ${run}`);
          assertCleanSession(session, `ta-dashboard-delay run ${run}`);
          runs.push({
            run,
            headingVisibleMs: headingAt,
            pipelineMetricVisibleMs: pipelineAt,
            jobOpeningsMetricVisibleMs: openingsAt,
            complianceBannerVisibleMs: complianceBannerAt,
            complianceResponseFulfilledMs: complianceFulfilledAt,
            openingsMinusCompliance: openingsAt - complianceFulfilledAt,
            cls: metrics.cls,
            clsAttribution: metrics.clsAttribution,
            fulfilledMs: {
              pipeline: fulfilledAfter(session, "GET /api/ta/analytics/pipeline", t0),
              dashboardCounts: fulfilledAfter(session, "GET /api/ta/dashboard-counts", t0),
              analyticsDashboard: fulfilledAfter(session, "GET /api/ta/analytics/dashboard", t0),
              complianceInterviews: fulfilledAfter(session, "GET /api/ta/compliance/interviews", t0),
            },
            lcpMs: metrics.lcpMs,
            pageErrors: session.errors.length,
          });
        } finally {
          await session.close();
        }
      }
      persist("ta-dashboard-delay", {
        scenario: "/ta with /api/ta/compliance/interviews delayed 2,000 ms (SMALL fixtures, CPU 4x)",
        runs,
        jobOpeningsMetricVisibleMs: rangeOf(runs.map((r) => r.jobOpeningsMetricVisibleMs as number)),
        complianceResponseFulfilledMs: rangeOf(runs.map((r) => r.complianceResponseFulfilledMs as number)),
        cls: rangeOf(runs.map((r) => r.cls as number)),
      });
    });
  });

  test("applicant dashboard: delayed endpoints", async ({ browser }) => {
    test.setTimeout(20 * 60_000);
    await required("applicant-dashboard-delay", async () => {
      const variants = [
        { name: "delayOpenJobsPreview", endpoint: "/api/applicant-jobs/jobs", note: "jobs preview query, not part of the page gate" },
        { name: "delayMyApplications", endpoint: "/api/applicant-jobs/my-applications", note: "applications query, part of the page gate" },
      ];
      const output: Record<string, unknown> = {};
      for (const variant of variants) {
        const runs: Array<Record<string, unknown>> = [];
        for (let run = 1; run <= ROUTE_RUNS; run += 1) {
          const session = await openSession(browser, {
            identity: "APPLICANT",
            scale: SMALL_SCALE,
            delays: { [variant.endpoint]: 2000 },
          });
          const page = session.page;
          try {
            const t0 = Date.now();
            await page.goto("/app", { waitUntil: "load" });
            const headingAt = await waitForTextAt(page, "Candidate Portal", t0);
            const applicationsAt = await waitForTextAt(page, "Recent Applications", t0);
            const recommendedAt = await waitForTextAt(page, "Recommended Positions for You", t0);
            await page.waitForTimeout(1500);
            // Read only after the delayed response has been fulfilled (fulfilment is stamped after the delay).
            for (let waited = 0; session.net.apiFulfilledAt[`GET ${variant.endpoint}`] === undefined && waited < 10_000; waited += 100) await page.waitForTimeout(100);
            if (session.net.apiFulfilledAt[`GET ${variant.endpoint}`] === undefined) throw new Error(`delayed endpoint ${variant.endpoint} was never fulfilled`);
            const delayedFulfilledAt = session.net.apiFulfilledAt[`GET ${variant.endpoint}`] - t0;
            const metrics = await collectMetrics(page);
            assertMetrics(metrics, `applicant-dashboard-delay ${variant.name} run ${run}`);
            assertCleanSession(session, `applicant-dashboard-delay ${variant.name} run ${run}`);
            runs.push({
              run,
              headingVisibleMs: headingAt,
              recentApplicationsVisibleMs: applicationsAt,
              recommendedJobsVisibleMs: recommendedAt,
              delayedResponseFulfilledMs: delayedFulfilledAt,
              fulfilledMs: {
                myApplications: fulfilledAfter(session, "GET /api/applicant-jobs/my-applications", t0),
                openJobsPreview: fulfilledAfter(session, "GET /api/applicant-jobs/jobs", t0),
                invitations: fulfilledAfter(session, "GET /api/applicant-jobs/invitations", t0),
                profile: fulfilledAfter(session, "GET /api/applicants/profile", t0),
              },
              cls: metrics.cls,
              lcpMs: metrics.lcpMs,
              pageErrors: session.errors.length,
            });
          } finally {
            await session.close();
          }
        }
        output[variant.name] = {
          delayedEndpoint: variant.endpoint,
          note: variant.note,
          runs,
          recentApplicationsVisibleMs: rangeOf(runs.map((r) => r.recentApplicationsVisibleMs as number)),
          recommendedJobsVisibleMs: rangeOf(runs.map((r) => r.recommendedJobsVisibleMs as number)),
          cls: rangeOf(runs.map((r) => r.cls as number)),
        };
      }
      persist("applicant-dashboard-delay", { scenario: "/app, one endpoint delayed 2,000 ms (CPU 4x)", variants: output });
    });
  });

  test("workforce: redeployment queue requests and TA list payloads", async ({ browser }) => {
    test.setTimeout(20 * 60_000);
    await required("workforce", async () => {
      const variants = [
        { name: "deploymentsTabDefault", path: "/ta/workforce" },
        { name: "employeesTab", path: "/ta/workforce?tab=employees" },
        { name: "followUpsTab", path: "/ta/workforce?tab=follow-ups" },
        { name: "redeploymentTab", path: "/ta/workforce?tab=redeployment" },
      ];
      const queue = "GET /api/employees/redeployment-queue";
      const suggestions = "GET /api/employees/redeployment-queue/suggestions";
      const summary = "GET /api/employees/redeployment-queue/summary";
      const deployments = "GET /api/ta/deployments";
      const mrfs = "GET /api/ta/mrfs";
      const shaped = (counts: Record<string, number>, key: string) => ({
        full: counts[`${key} [full]`] ?? 0,
        paged: counts[`${key} [paged]`] ?? 0,
      });
      const output: Record<string, unknown> = {};
      for (const variant of variants) {
        const runs: Array<Record<string, unknown>> = [];
        for (let run = 1; run <= 3; run += 1) {
          const session = await openSession(browser, { identity: "TALENT_ACQUISITION", scale: LARGE_SCALE });
          try {
            await gotoAndSettle(session.page, variant.path, 2000);
            const net = session.net;
            const queueShape = shaped(net.apiCounts, queue);
            assertCleanSession(session, `workforce ${variant.name} run ${run}`);
            if (variant.name === "redeploymentTab" && queueShape.full + queueShape.paged === 0) throw new Error("redeployment tab never requested the queue");
            runs.push({
              run,
              redeploymentQueueFullRequests: queueShape.full,
              redeploymentQueuePagedRequests: queueShape.paged,
              redeploymentSummaryRequests: net.apiCounts[summary] ?? 0,
              redeploymentSuggestionRequests: net.apiCounts[suggestions] ?? 0,
              deploymentsFullRequests: shaped(net.apiCounts, deployments).full,
              deploymentsPagedRequests: shaped(net.apiCounts, deployments).paged,
              mrfsFullRequests: shaped(net.apiCounts, mrfs).full,
              mrfsPagedRequests: shaped(net.apiCounts, mrfs).paged,
              employeeRequests: net.apiCounts["GET /api/employees"] ?? 0,
              servedBytes: {
                redeploymentQueuePaged: net.apiBytes[`${queue} [paged]`] ?? 0,
                redeploymentQueueFull: net.apiBytes[`${queue} [full]`] ?? 0,
                redeploymentSummary: net.apiBytes[`${summary} [full]`] ?? 0,
                suggestions: net.apiBytes[`${suggestions} [full]`] ?? 0,
                deploymentsPaged: net.apiBytes[`${deployments} [paged]`] ?? 0,
                deploymentsFull: net.apiBytes[`${deployments} [full]`] ?? 0,
              },
              unexpectedApi: net.unexpectedApi,
            });
          } finally {
            await session.close();
          }
        }
        output[variant.name] = {
          path: variant.path,
          redeploymentQueueFullRequests: rangeOf(runs.map((r) => r.redeploymentQueueFullRequests as number)),
          redeploymentQueuePagedRequests: rangeOf(runs.map((r) => r.redeploymentQueuePagedRequests as number)),
          runs,
        };
      }
      const ctx = { identity: "TALENT_ACQUISITION" as IdentityKey, scale: LARGE_SCALE };
      const bytesOf = (path: string) => fixtureBytes("GET", new URL(`http://localhost:3000${path}`), ctx);
      const payloads = {
        note: "Fixture body bytes. full = legacy complete list at 1,000 rows; paged = first page with the page size the client sends.",
        taMrfs: { full: { rows: LARGE_SCALE.mrfs, bytes: bytesOf("/api/ta/mrfs") }, paged: { pageSize: 8, bytes: bytesOf("/api/ta/mrfs?page=1&pageSize=8") } },
        taDeployments: {
          full: { rows: LARGE_SCALE.deployments, bytes: bytesOf("/api/ta/deployments") },
          paged: { pageSize: 10, bytes: bytesOf("/api/ta/deployments?page=1&pageSize=10") },
        },
        redeploymentQueue: {
          full: { rows: LARGE_SCALE.redeploymentQueue, bytes: bytesOf("/api/employees/redeployment-queue") },
          paged: { pageSize: 10, bytes: bytesOf("/api/employees/redeployment-queue?page=1&pageSize=10") },
          summary: { bytes: bytesOf("/api/employees/redeployment-queue/summary") },
          suggestionsFor25: { bytes: bytesOf("/api/employees/redeployment-queue/suggestions?employeeIds=" + Array.from({ length: 25 }, (_, i) => i + 1).join(",")) },
        },
      };
      persist("workforce", { scenario: "/ta/workforce variants and TA list endpoints at 1,000 rows (CPU 4x)", variants: output, payloads });
    });
  });

  test("tab hide/show refetch count", async ({ browser }) => {
    test.setTimeout(5 * 60_000);
    await required("tab-hide-show", async () => {
      // A real SSE server that never ends: the harness fixture body is finite and would drop the stream every second.
      const open = new Set<import("node:net").Socket>();
      const server: Server = createServer((req, res) => {
        res.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          "access-control-allow-origin": req.headers.origin ?? "*",
          "access-control-allow-headers": "*",
        });
        res.write(": open\n\n");
      });
      server.on("connection", (socket) => { open.add(socket); socket.on("close", () => open.delete(socket)); });
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const port = (server.address() as { port: number }).port;
      const session = await openSession(browser, {
        identity: "TALENT_ACQUISITION",
        scale: SMALL_SCALE,
        streamUrl: `http://127.0.0.1:${port}/stream`,
      });
      const page = session.page;
      try {
        await gotoAndSettle(page, "/ta", 3000);
        const total = () => Object.entries(session.net.apiCounts).filter(([key]) => key.split(" ").length === 2).reduce((sum, [, n]) => sum + n, 0);
        const before = total();
        const countsBefore = { ...session.net.apiCounts };
        for (let i = 0; i < 3; i += 1) {
          await page.evaluate(() => {
            const set = (state: string) => {
              Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
              Object.defineProperty(document, "hidden", { configurable: true, get: () => state === "hidden" });
              document.dispatchEvent(new Event("visibilitychange"));
            };
            set("hidden");
            set("visible");
          });
          await page.waitForTimeout(1500);
        }
        await page.waitForTimeout(2000);
        const after = total();
        const extra: Record<string, number> = {};
        for (const [key, n] of Object.entries(session.net.apiCounts)) {
          const delta = n - (countsBefore[key] ?? 0);
          if (delta > 0 && key.split(" ").length === 2) extra[key] = delta;
        }
        assertCleanSession(session, "tab-hide-show");
        persist("tab-hide-show", {
          scenario: "/ta with a held-open SSE stream; 3 hide/show cycles via visibilitychange; /api/ requests after settle",
          requestsAfterThreeCycles: after - before,
          requestsPerCycle: (after - before) / 3,
          extraRequests: extra,
        });
        if (after - before > 4) throw new Error(`tab hide/show caused ${after - before} /api/ requests (limit 4)`);
      } finally {
        await session.close();
        for (const socket of open) socket.destroy();
        server.close();
      }
    });
  });

  test("network profile: landing and /app/jobs at 150 ms / 1.6 Mbps / 750 Kbps (PERF_NETWORK=slow)", async ({ browser }) => {
    test.setTimeout(20 * 60_000);
    if (!SLOW_NETWORK) {
      optional("network", "set PERF_NETWORK=slow to run the network profile");
      test.skip(true, "optional probe: set PERF_NETWORK=slow to run the network profile");
    }
    await required("network", async () => {
      const routes: Array<{ path: string; identity: IdentityKey | null }> = [
        { path: "/", identity: null },
        { path: "/app/jobs", identity: "APPLICANT" },
      ];
      const results: Record<string, unknown> = {};
      for (const route of routes) {
        const session = await openSession(browser, { identity: route.identity ?? undefined, scale: SMALL_SCALE });
        try {
          await gotoAndSettle(session.page, route.path, 0);
          await session.page.evaluate(() => document.fonts.ready.then(() => true));
          await session.page.waitForTimeout(10_000);
          const metrics = await collectMetrics(session.page);
          assertMetrics(metrics, `network ${route.path}`);
          assertCleanSession(session, `network ${route.path}`);
          // Validation that the profile reached real requests: every .js resource should take at least the latency.
          const jsDurations = await session.page.evaluate(() =>
            (performance.getEntriesByType("resource") as PerformanceResourceTiming[])
              .filter((e) => /\.m?js$/i.test(new URL(e.name).pathname))
              .map((e) => Math.round(e.responseEnd - e.startTime)),
          );
          results[route.path] = {
            lcpMs: metrics.lcpMs,
            cls: metrics.cls,
            jsCount: metrics.jsCount,
            jsTransferBytes: metrics.jsBytes,
            jsRawBytes: metrics.jsRawBytes,
            imageBytes: metrics.imageBytes,
            fontBytes: metrics.fontBytes,
            longtaskTotalMs: metrics.longtaskTotalMs,
            jsMinDurationMs: jsDurations.length ? Math.min(...jsDurations) : null,
            jsMaxDurationMs: jsDurations.length ? Math.max(...jsDurations) : null,
            apiRequests: Object.values(session.net.apiCounts).reduce((total, n) => total + n, 0),
            unexpectedApi: session.net.unexpectedApi,
            blockedExternal: session.net.blockedExternal,
            pageErrors: session.errors.length,
          };
        } finally {
          await session.close();
        }
      }
      writeResult(OUT, "network", {
        scenario: "network profile, one fresh-context sample per route; 10 s settle after fonts.ready; CPU 4x",
        profile: { cpuThrottleRate: CPU_RATE, ...SLOW_NETWORK_PROFILE },
        dist: DIST,
        label: LABEL,
        results,
      });
    });
  });

  test("required scenarios all produced evidence", async ({}, testInfo) => {
    // Full runs must cover every required scenario; filtered runs (-g, PERF_ROUTES) only check what ran.
    const filtered = String(testInfo.config.grep) !== String(/.*/) || !!process.env.PERF_ROUTES;
    const expected = ["bundle", "routes", "landing", "address-picker", "mrf-search", "admin-analytics", "ta-dashboard-delay", "applicant-dashboard-delay", "workforce"];
    const names = filtered ? [...requiredRan] : [...new Set([...expected, ...requiredRan])];
    const bad = names.filter((name) => {
      const value = summary[name] as { skipped?: unknown; failed?: unknown } | undefined;
      return value === undefined || value === null || typeof value !== "object" || "skipped" in value || "failed" in value;
    });
    if (bad.length) throw new Error(`required scenarios without evidence: ${bad.join(", ")}`);
  });

  test.afterAll(() => {
    if (optionalSkipped.size) console.log(`[perf] optional probes not run: ${[...optionalSkipped].join(", ")}`);
    writeSummary();
    console.log(`[perf] wrote ${path.join(OUT, "summary.json")}`);
  });
});
