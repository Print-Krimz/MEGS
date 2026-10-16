# MEGS Performance Optimization Report

**Date:** October 16, 2026  
**Plan executed:** `PERFORMANCE_OPTIMIZATION_PLAN.md` (audited commit `1c289b9`)  
**State:** Code complete in the working tree. Nothing committed, migrated, or deployed. No staging or production measurement.

## 1. Summary

Tasks P1, P2, P3, P4, P7, P9 and P10 meet their acceptance targets in laboratory measurement. P5 and P6 are partly done: the safe parts shipped, and the rest needs a real database. P8, P11 and the P12 memory investigation were not started, because the plan requires disposable-database measurement or explicit approval first.

| Headline metric | Baseline | After | Change | Target |
| --- | ---: | ---: | ---: | --- |
| Initial JavaScript, gzip | 244,653 B | 119,721 B | -51% | <= 200,000: met |
| Address picker open-click p95 | 736 ms | 64 ms | -91% | <= 200 ms: met |
| Address picker mounted options | 897 | 14 | | <= 60: met |
| TA dashboard section visible after its own response | 2,348 ms (gated) | 418 ms | | <= 500 ms: met |
| `/ta` CLS | 0.0013 | 0.0384 | | <= 0.1: met |
| TA list page payloads (1,000 rows) | 0.65-1.53 MB | 6.8-14.8 KB | -99% | >= 90% cut: met |
| Redeployment suggestions CPU, 10-worker page | 453 ms (full list) | 4.7 ms | -99% | >= 80% cut: met |
| Landing images incl. favicon, settled | 509,883 B | 135,899 B | -73% | <= 250,000: met |
| Landing images, after scrolling the whole page | 1,635,801 B | 479,455 B | -71% | <= 250,000: not met |
| Favicon | 36,123 B | 1,991 B | -94% | <= 5 KB: met |

## 2. How the work was run

- An orchestrator (Opus) split the plan into file-disjoint tasks. Sonnet agents implemented P1, P2, P3, P4, P5, P6, P7, P9 and P10. A Haiku agent built the browser harness and ran all baseline and after measurements.
- P6 ran after P4, because both edit `employee.service.ts`. All other implementation tasks ran in parallel.
- A production build of the unmodified source was frozen before any edit. All baseline numbers come from that build, so parallel edits could not leak into the baseline.
- The orchestrator reviewed every diff. It checked route order, validation, ownership scoping, raw-SQL parameter binding and document authorization. It fixed two test expectations and one layout regression (section 5).

## 3. Measurement method

- **Harness:** `frontend/perf/` (Playwright against `vite preview` of a built `dist`, port 4173). Headless Chromium, 1440 x 900, CPU throttled 4x. Every API request is answered from backend-shaped fixtures. Unexpected non-localhost requests fail the run. All after runs had 0 unexpected requests and 0 page errors.
- **Run:** see `frontend/perf/README.md`. Results are written to `frontend/test-results/perf/<label>/` (ignored by git).
- **Variance control:** the three interaction scenarios and the dashboard probes ran interleaved (baseline, after, baseline, after) and were pooled across 3 runs of 20 interactions each.
- **Limits:** Event Timing has a 16 ms floor. LCP is from one 5-context run per build, so treat LCP changes as directional. The 150 ms / 1.6 Mbps network profile and warm HTTP cache were not rerun. These are laboratory results, not field Core Web Vitals.

## 4. Results by task

### P1: Reduce initial JavaScript (done)

Changes:
- `LandingFeaturedCompanies.tsx` imports `Pagination` directly instead of through the common barrel.
- `routes.tsx` loads `LandingPage` with `lazyRouteComponent`.
- `ChangePasswordModal` was removed from the common barrel. The three layouts load it only when it opens.

| Step | Initial JS gzip |
| --- | ---: |
| Baseline | 244,653 |
| Direct `Pagination` import | 202,001 |
| Lazy `LandingPage` | 119,404 |
| Lazy password dialog | 119,725 |
| Integrated tree (all tasks) | 119,721 |

- Protected routes no longer load public motion code.
- Public `/` total JS dropped from 803,957 to 646,730 raw bytes (-20%), so bytes were removed, not just moved out of the initial graph.
- Protected routes dropped 24-39% of raw JS (for example `/app` 844,803 to 512,758).
- Long-task total time fell on every route, for example `/` 2,065 to 1,926 ms and `/ta` 911 to 651 ms. The 20% startup long-task target is met on most protected routes, but not on `/` (-7%).
- Password rules, strength feedback and the 72-byte limit are unchanged. The dialog now unmounts immediately on close, so any close animation is gone.

### P2: Address picker (done)

- `ComboBox` gained an opt-in `windowed` prop: fixed 52 px rows, 8 rows of overscan, absolute positioning inside a full-height list.
- It is ignored for grouped, custom-entry and loading lists. Only the NCR barangay picker turns it on.
- Search text, barangay numbers and duplicate counts are precomputed once per options change.
- Highlight scrolling sets the list's own `scrollTop` instead of calling `scrollIntoView`.
- Windowed rows carry `aria-setsize` and `aria-posinset`. The active row is always mounted.

| Metric (3 runs x 20 opens) | Baseline | After |
| --- | ---: | ---: |
| Mounted options | 897 | 14 |
| Open-click median | 520 ms | 48 ms |
| Open-click p95 | 736 ms | 64 ms |
| Typing p95 | 104 ms | 48 ms |

All 897 options remain reachable. Unit tests cover keyboard reach to the last option, numeric search on the full list, and `aria-activedescendant` pointing at a mounted row. ComboBox never had Home/End handling, so none was added.

### P3: Independent dashboard sections (done)

- `TADashboard` and `ApplicantDashboard` no longer hide everything until every query finishes. Each section has its own skeleton with reserved height, its own error state, and a retry that refetches only that query.
- A failed metric shows "—" with "Try again", never a fake 0.

| Probe (one endpoint delayed 2 s, 5 runs) | Baseline | After |
| --- | ---: | ---: |
| TA: job openings visible after their own response | 2,348 ms (waited for compliance) | 418 ms |
| Applicant: Recent Applications with jobs delayed | 1,455-1,586 ms | 1,046-1,306 ms |
| Applicant: Recent Applications with applications delayed | 3,212-4,638 ms | 1,107-1,222 ms |
| `/app` CLS | 0.0653 | 0.0594 |

Behaviour changes to note:
- A profile error used to show 0% readiness silently. It now shows an error in the readiness card.
- Recommended Positions is still hidden when the jobs list is empty, as before.

### P4: Bounded TA workloads (done)

- Opt-in pagination on `GET /api/ta/mrfs`, `/api/ta/deployments`, `/api/ta/compliance/interviews` and `/api/employees/redeployment-queue`. With `page`/`pageSize` the response is `{items,total,page,pageSize,totalPages}`; without them it is the legacy response. `pageSize` is capped at 100.
- New `GET /api/employees/redeployment-queue/summary`, registered before the `/:id` routes.
- The suggestions endpoint accepts `employeeIds` (up to 25 unique IDs) and rechecks eligibility.
- MRF, Deployments, Interviews and Redeployment Queue pages use the paged forms with the existing 300 ms debounce, abort signals and previous-page placeholders.
- The Workforce badge uses the summary endpoint. The assignment dialog loads open jobs only when a target is chosen.

| Workforce / list measurement | Baseline | After |
| --- | ---: | ---: |
| Full-queue requests on non-redeployment tabs | 1 per tab | 0 |
| `/api/ta/mrfs` first page | 1,531,804 B | 12,311 B |
| `/api/ta/deployments` first page | 1,486,615 B | 14,831 B |
| Redeployment queue first page | 653,912 B | 6,820 B |
| Queue badge | full queue | 128 B summary |
| Suggestions for visible page | 542,693 B | 5,470 B |
| MRF search keystroke p95 (1,000 rows) | 112 ms | 80 ms |

- Suggestion CPU, measured with mocked Prisma, 1,000 workers, 60 jobs and 768-dimension vectors: 453 ms for the full list against 4.7 ms for a 10-worker page. Rankings for the requested workers are identical.
- Still on the legacy contract: ClientDetailPage, CloneMRFModal, JobPostingsPage, the TA dashboard interview summary, and `getRedeploymentQueue`.
- The paged redeployment queue and interview report still read lean rows for the whole pool, then filter and slice in memory. This keeps ordering identical but is not SQL-level paging.

### P5: Analytics discarded work (partly done)

- **Kept, step 1:** `getTADelivery` and `getAdminDelivery` no longer build report detail. Report and export functions still build full detail from the same compute function, so totals cannot drift.
- **Reverted, step 2:** single-pass grouping maps. Paired A/B runs gave about 22% lower CPU, pooled about 24%, which is under the plan's 25% retention bar.
- **Not done:** steps 3-5 (grouped first-placement query, SQL measurement and aggregate changes). They need a real database.

| Benchmark (mocked Prisma, 20,000 applications, 1,000 requests) | Original | Step 1 kept |
| --- | ---: | ---: |
| Allocated per dashboard pair | 153 MB | 134 MB (-12%) |
| CPU | about 5.9 s | about 5.9 s (no change) |

All 6 golden parity snapshots (TA and Admin dashboard and report, recruiter filter) deep-equal the original output.

### P6: Returning filter and photo N+1 (partly done)

- **Done:** new `resolveDocumentSignedUrls` batch resolver in `document.service.ts`. It makes one metadata query, at most two authorization queries per requester, and one `createSignedUrls` per bucket. It is used by the TA application list and `listEmployees`. Failures return `null` per row, as the old per-row catch did.

| Rows with photos | Calls before | Calls after |
| ---: | ---: | ---: |
| 1 | 3 | 3 |
| 25 | 75 | 3 |
| 100 | 300 | 3 (-99%) |

- **Partly done:** the returning-applicant query now uses `EXISTS`, is narrowed to the requested job, and for TAs to their owned jobs. It is still a parameterized `$queryRaw` that returns an ID list.
- Why not fully relational: Prisma relation filters cannot compare a deployment date with its parent application's date, which the placement chronology requires.
- For administrators the ID list is still global.
- The parity test models the SQL predicate in JavaScript. It proves scoping and parameter binding, not Postgres behaviour.

### P7: Embedding deadline and coalescing (done)

- Embedding calls go through a new `embedContentWithDeadline` helper in `gemini.ts`, with a 10 s deadline. The request is aborted through the SDK's `abortSignal`, and the capacity slot is released only after the abort.
- Concurrent batch callers share pending per-key promises. Failed entries are evicted from the cache.
- Tests: a never-settling provider fails at 10,000 ms of fake time (limit 11 s). After 3 hung calls, peak concurrency was 2 and the next call succeeded. Overlapping cold batches cost one provider computation per unique key.
- The stale embedding unit-suite mock was repaired.

### P9: Analytics tab responsiveness (done)

- Profiling (React profiling build, 1,000 rows, 24 recruiters) showed hidden `StuckList` and `RequestProgressList` re-rendering on every tab click.
- They and `TeamTable` are now `React.memo`, with a stable `selectRecruiter` callback.
- Analytics dashboard requests now pass the query's abort signal. Superseded range changes show `net::ERR_ABORTED`; before the change, nothing was aborted.

| Metric | Before | After |
| --- | ---: | ---: |
| React render per tab click, profiling build, median | 26-27 ms | 14-19 ms (about -40%) |
| Tab-click p95, production build, pooled | 144 ms | 152 ms |

The p95 target (<= 200 ms) holds in both builds. The p95 change is within noise. Most remaining click cost is style, layout and paint, not React.

### P10: Public images and favicon (images done, fonts unchanged)

- 13 WebP variants were generated from the existing images, sized to about 2x their rendered size. Source images are kept.
- Only `src` paths changed. Crops, dimensions, alt text and lazy loading are unchanged.
- The favicon is now `favicon-48.png` (1,991 B). `favicon.jpg` is no longer referenced.
- The landing page meets 250 KB when settled (135,899 B). After scrolling all six industry cards it loads 479,455 B. Shrinking the 800 px cards further risked visible quality loss, so the work stopped there.
- **Fonts:** Archivo is already split by unicode range into latin, latin-ext and vietnamese files. No change could be shown to save 25% while keeping Filipino glyphs, the peso sign and the 112% width.

## 5. Regressions found and fixed

- **`/ta` CLS rose from 0.0013 to 0.2135** after P3. Attribution showed the interview-deadline banner arriving after the sections below it, pushing three panels down by 82-89 px.
  - Fix 1: an invisible copy of the banner holds its space while the deadline check is pending. CLS fell to 0.1365.
  - Fix 2: the pipeline stage skeleton (62 px) was shorter than the loaded tiles (69 px). The skeleton now uses the same padding and line heights. CLS fell to **0.0384** in all 5 runs.
  - Remaining risk: a TA with no overdue or due-soon interviews sees the reserved space collapse when the check finishes. That causes one upward shift, but only when the check is slower than the other sections.
- **`ta.api.test.ts`:** 2 expectations updated for the new `{ signal }` argument on `getDashboardSummary`.

## 6. Test results

| Check | Result |
| --- | --- |
| Frontend typecheck (`tsc -p tsconfig.app.json --noEmit`) | Pass |
| Frontend production build (`npm run build`) | Pass |
| Bundle budget (`node frontend/scripts/measure-bundle.mjs`) | Pass: 119,721 B; Leaflet and address data absent from initial graph |
| Frontend unit tests, full run | 727 of 728 pass |
| Frontend TA pages after final fix | 114 of 114 pass |
| Backend typecheck (`npx tsc --noEmit`) | Pass |
| Backend mocked suites (14 files, incl. plan's safe set, P4/P5/P6/P7 tests) | 163 of 163 pass |
| Production-preview harness, after build | 10 of 10 scenarios pass, 0 unexpected API calls |
| `git diff --check` | Pass |

- The one frontend failure, `DateTimePicker > disables past days strictly before minDate`, is in a file no task touched. It looks date-dependent and is unrelated to this work.
- Backend: `document.service.test.ts` has one failing upload test ("File contents do not match a supported document type"). It is unrelated to P6.
- Backend: `ta.applications.summary.test.ts` was already failing because its Prisma mock lacked `deployment`. P6 added the mock.
- Safety note: during P4 an agent ran `ta.mrf-priority-sorting.test.ts`, which uses the real database. It failed at connection (`SASL ... client password must be a string`) before creating any records. No other database-backed test was run.
- Not run: the full backend suite (it hits the hosted database) and the existing dev-server E2E suites, including `loading-performance.spec.ts`. They start the dev server and are not isolated from real services.

### 10-point HCI check (UI changes in P1, P2, P3, P4, P9)

| # | Check | Result |
| --- | --- | --- |
| 1 | Understandability | Pass. Layouts unchanged; sections now load independently. |
| 2 | Zero duplication | Pass. No new labels or actions. |
| 3 | Plain language | Pass. New copy limited to "Try again" and "Loading information" for screen readers. |
| 4 | Smart automation | Pass. Postal autofill and dependent-field clearing preserved. |
| 5 | Consistency | Pass. Section states reuse the AdminDashboard pattern and `ErrorState`. |
| 6 | Anti-slop | Pass. No new cards, badges, gradients or icons. |
| 7 | Next-step clarity | Pass. Deadline banner and its "View interview queue" action unchanged. |
| 8 | Error recovery | Improved. Per-section retry instead of a whole-page failure. |
| 9 | Accessibility | Pass. Windowed list keeps `aria-setsize`/`aria-posinset` and an always-mounted active row. The hidden banner copy is `aria-hidden` and not focusable. |
| 10 | Responsive layout | Pass in code review. Skeleton uses the same responsive padding as loaded tiles. Mobile viewport was not measured with the harness. |

## 7. Regression tooling now tracked

These are now tracked through narrow ignore exceptions:
- `frontend/perf/` (harness, fixtures, config, README). Not ignored; nothing needed.
- `frontend/scripts/measure-bundle.mjs`, through an exception in `frontend/.gitignore`. Other scripts stay ignored.
- `backend/src/services/analytics/delivery.parity.test.ts` with its `delivery.fixtures.ts` and `__fixtures__/delivery-parity/`.
- `backend/src/services/employee/redeployment-suggestions.service.test.ts`.
- `backend/src/services/scoring/embedding.service.test.ts`.

The P4 and P6 tests in `backend/src/__tests__/` and the frontend unit tests stay local-only under the existing `__tests__/` rule.

A new workflow, `.github/workflows/performance.yml`, runs the bundle budget on pull requests that touch `frontend/`. It fails when initial JS gzip exceeds 200,000 B or deferred modules enter the initial graph. It is not connected to deployment. It has not run on GitHub yet.

## 8. Remaining work

Needs a disposable database or staging data:
- P5 steps 3-5: grouped first-placement query; query count, SQL duration, pool wait and payload measurement; filter-option query reuse.
- P6: a fully relational returning filter for administrators, and checking the `EXISTS` query against real Postgres.
- P8: export and backup memory work. It must be benchmarked first; nothing was changed.
- P11: legacy repair backfill and index evidence. This needs read-only inventory, then approval before any shared-database write.
- Real API p50/p95 for paged lists and analytics dashboards.

Frontend follow-ups:
- P12 memory: 100-cycle SPA heap snapshots and retainer analysis. Not started.
- Landing page images when the whole page is scrolled (479 KB against 250 KB). This needs smaller industry-card variants and a visual quality check.
- Migrate the remaining legacy full-list callers (ClientDetailPage, CloneMRFModal, JobPostingsPage), then consider SQL-level paging for the redeployment queue and interview report.
- Rerun the 150 ms / 1.6 Mbps network profile and the warm HTTP cache comparison.
- Delete the unreferenced `frontend/public/favicon.jpg` if nothing else needs it.

Not done in any environment:
- No commits, migrations, backfills, deployments, or live backup or restore.
