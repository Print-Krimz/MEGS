# MEGS Performance Optimization Plan

## 1. Executive summary

**Repository:** `C:\Users\cnico\OneDrive\Desktop\MEGS`  
**Audit date:** October 16, 2026, Asia/Manila  
**Audited commit:** `1c289b9828071e6c18e5e46efa24f0502ae44271`  
**Status:** Audit and implementation handoff only. No optimizations implemented.  
**Audience:** Claude Code implementing changes in this same checkout.

No application optimizations, migrations, deployments, or business-logic changes were performed during this audit. The pre-existing `.gitignore` modification was preserved. This document is explicitly located in the repository root as requested; supporting documentation belongs under the existing `docs/` hierarchy.

The strongest measured opportunities are:

1. Initial JavaScript exceeds the existing bundle budget.
2. Manila's 897-option barangay picker produces slow click interactions.
3. Applicant and TA dashboards withhold successful sections while unrelated requests finish.
4. Analytics tab interactions slow down with large report fixtures.
5. Several TA screens download complete datasets despite displaying only one page.

Backend inspection also confirmed expensive workload shapes in redeployment suggestions, analytics, document-photo resolution, exports, and backups. Their production latency and memory impact remain unmeasured.

**No Critical finding was established.** High priorities below reflect measured frontend problems or confirmed scaling problems in active code paths. Medium and Low investigation priorities do not authorize speculative optimization.

### Evidence boundaries

- **Measured laboratory evidence:** Browser timings, resource sizes, the bundle-budget failure, interaction costs, and forced-GC heap samples.
- **Verified structural evidence:** Code paths with complete-list reads, repeated scans, per-row resolver calls, discarded report construction, and full-data materialization. Their execution shape is confirmed; their live duration is not.
- **Suspected or unverified:** Application-owned memory leaks, missing deployed indexes, database contention, production response times, and production Core Web Vitals.
- Browser measurements used a fresh production build, isolated API fixtures, and fake browser identities. No authenticated request reached a real backend. The user selected this isolated audit approach.
- Fixtures normally responded after 100 ms. Empty or small datasets established route baselines; larger fixtures exercised selected interactions.
- Login, Turnstile verification, uploads, actual hiring mutations, live backups/restores, and real database latency were not benchmarked.
- Database index definitions were inspected. Applied indexes, query plans, lock contention, and production cardinalities were not verified.
- Event Timing measurements below describe individual laboratory interactions, **not field INP**.

### Existing optimizations to preserve

- Native TanStack `lazyRouteComponent`, guard-first protection, route preloading, and active Workforce-tab code loading.
- Server pagination for Jobs, Saved Jobs, major application lists, and Admin users. Saved Jobs pagination is already implemented; do not repeat an older recommendation to add it.
- Existing search debounce/cancellation, previous-data placeholders, and query freshness policies.
- Applicant processing-versus-idle polling, invitation polling, scoped notification invalidation, token-rotation reconnects, and notification reconciliation polling.
- Image dimensions, lazy image loading, asynchronous decode, region-lazy non-NCR barangay data, and asynchronous backup gzip.
- Bounded job embedding caches and existing batch embedding requests.
- Deployment lifecycle based on actual actions. `autoPromoteDeployments` is currently empty; do not restore date-driven activation from older notes.
- Disabled email polling and dormant worker paths must not be described as active production polling bottlenecks.

## 2. Baseline measurements

### Method

- Windows, Node.js 22.19.0.
- Python Playwright 1.48.0 controlling installed Chrome 155.0.8059.82.
- Production Vite build generated outside the repository in temporary storage and served through Vite preview on `127.0.0.1:4173`.
- Headless browser, 1440 x 900 viewport, CPU throttled 4x.
- Five fresh browser contexts per baseline route.
- LCP, CLS, long tasks, resource requests, DOM size, and heap measured through PerformanceObserver and Chrome DevTools Protocol.
- V8 CPU profiling additionally recorded address-picker interactions.
- The baseline observation window ended 1.2 seconds after the first heading became visible. These are laboratory samples, not complete user-session vitals or full-workflow completion times.
- Network-throttled samples additionally waited for fonts and ten seconds of settling.
- External requests were blocked. All API requests were intercepted. Finite mocked SSE responses reconnect artificially; their request counts must not be interpreted as a production reconnect defect.

Playwright routing disables HTTP caching. These results therefore do not establish warm HTTP-cache performance. SPA navigation separately tested reuse of loaded modules and query data. See [Playwright routing documentation](https://playwright.dev/docs/api/class-browsercontext#browser-context-route).

### Route baseline

LCP values are medians and observed ranges, not statistically reliable p95 estimates.

| Route | Samples | Median LCP | Observed LCP range | Maximum observed CLS |
| --- | ---: | ---: | ---: | ---: |
| Public landing `/` | 5 | 3,712 ms | 2,656-4,436 ms | 0.0025 |
| Applicant dashboard `/app` | 5 | 2,256 ms | 2,132-3,900 ms | 0.0408 |
| Applicant jobs `/app/jobs` | 5 | 3,156 ms | 2,556-3,964 ms | 0 |
| Applicant profile `/app/profile` | 5 | 4,156 ms | 2,380-6,016 ms | 0.0231 |
| TA dashboard `/ta` | 5 | 1,940 ms | 1,552-2,748 ms | 0.0013 |
| TA applications `/ta/applications` | 5 | 1,964 ms | 1,760-2,464 ms | 0 |
| TA requests `/ta/mrfs` | 5 | 1,776 ms | 1,556-2,256 ms | 0 |
| TA workforce `/ta/workforce` | 5 | 2,072 ms | 1,784-3,304 ms | 0 |
| Admin dashboard `/admin` | 5 | 2,984 ms | 2,044-3,460 ms | 0.0208 |
| Admin users `/admin/users` | 5 | 1,620 ms | 1,492-2,736 ms | 0 |

Run-to-run variance is substantial. Repeat comparisons under matching conditions; do not accept small percentage changes inside this variance.

### Bundle and resource baseline

| Measurement | Result |
| --- | ---: |
| Initial JavaScript | 803,957 bytes raw |
| Initial JavaScript gzip | **244,653 bytes** |
| Existing gzip limit | 200,000 bytes |
| Budget excess | **44,653 bytes / 22.3%** |
| Initial JavaScript chunks | 7 |
| Main CSS | 123,863 bytes raw / approximately 21.62 KB gzip |
| Public fonts requested | 176,344 bytes |
| Landing image resources observed, including favicon | 509,883 bytes |
| Profile's address-related chunk | 376,186 bytes raw / approximately 49.84 KB gzip |
| Profile's total observed JavaScript, including module preloads | 1,294,122 bytes raw |

The initial graph excludes Leaflet and address-reference data, as intended. It still includes public motion code, `ChangePasswordModal`, and Zod modules. Chunk names are misleading: the 118 KB `password-strength` chunk contains shared dependencies, not merely the small password evaluator. In-memory Vite module inspection confirmed both the modal and Zod schema modules in the initial graph.

### Additional workflow measurements

| Scenario | Result |
| --- | --- |
| Landing, 150 ms latency, 1.6 Mbps download, 750 Kbps upload, CPU 4x | Median LCP **5,188 ms**, range 4,052-6,488 ms; 3 samples |
| Applicant jobs under the same network profile | Median LCP **3,620 ms**, range 3,444-3,648 ms; 3 samples |
| Manila barangay picker | **897 options** rendered |
| Picker opening click duration | **872 / 976 / 928 ms**; median **928 ms** |
| Picker opening automation elapsed time | 1,269 / 1,477 / 1,277 ms; includes automation overhead |
| MRF search with 1,000 records | Maximum recorded keyboard-event durations **256 / 184 / 176 ms** across 3 runs |
| Admin analytics, 1,000 requests and 24 recruiters | Maximum recorded tab-click duration per run **512 / 288 / 256 ms** |
| Analytics chart mode button | 96 / 56 / 56 ms |
| Analytics steady scrolling | No frames over 50 ms in three approximately 1.2-second samples |
| Applicant dashboard-to-Jobs SPA navigation | First visit 468 ms; subsequent visits 230-361 ms in the initial 10-cycle probe |
| Fifty dashboard/Jobs navigation cycles | Post-GC heap increased from **4.935 MB to 7.765 MB** |

The heap increase requires retainer analysis without audit instrumentation. It does not yet prove an application memory leak. Repeated warm Jobs visits reused query data until its existing freshness interval expired; this is not evidence for blanket cache-policy changes.

A delayed TA dashboard test confirmed the loading gate: one run delivered dashboard counts at 3,042 ms and interview compliance at 5,036 ms. The already-available job-opening section remained hidden while compliance was pending.

### Checks completed

- Frontend `npm.cmd run typecheck`: passed.
- Backend `npx.cmd tsc --noEmit`: passed.
- Production Vite build: passed.
- Bundle-budget check: **failed**, as reported above.
- Focused frontend verification: **5 files, 83 tests passed**.
- Explicitly isolated backend verification: **7 files, 82 tests passed**.
- Browser probes reported no page exceptions.
- `git diff --check`: passed.

### Raw audit artifacts

These files existed at handoff time:

- `C:\Users\cnico\AppData\Local\Temp\megs-performance-audit-baseline.json`
- `C:\Users\cnico\AppData\Local\Temp\megs-performance-audit-interactions.json`
- `C:\Users\cnico\AppData\Local\Temp\megs-performance-audit-network.json`
- `C:\Users\cnico\AppData\Local\Temp\megs-performance-audit-spa50.json`
- `C:\Users\cnico\AppData\Local\Temp\megs-address.cpuprofile`
- `C:\Users\cnico\AppData\Local\Temp\megs-address-picker.png`
- `C:\Users\cnico\AppData\Local\Temp\megs-analytics.png`

The facts required for implementation are included here; do not depend on temporary files surviving. The JSON `jsBytes` field counted script initiators only; use the full `.js` resource list when including module preloads. Interaction-event details and SPA heap sample values were also emitted in the audit tool output and are summarized above; the JSON files do not contain every emitted diagnostic field.

## 3. Prioritized implementation tasks

### P1 - Reduce initial JavaScript

**Priority:** High. **Impact:** all first visits. **Complexity:** Low-Medium. **Risk:** Low-Medium.  
**Evidence:** measured budget failure; confirmed initial-module membership.

Affected areas:

- `frontend/src/routes.tsx`
- `frontend/src/components/public/LandingFeaturedCompanies.tsx`
- `frontend/src/components/common/index.ts`
- `frontend/src/components/common/ChangePasswordModal.tsx`

Implementation:

1. Replace the landing component's barrel import of `Pagination` with its direct module import.
2. Remeasure the import graph. The common barrel exposes `ChangePasswordModal`, whose top-level Zod schema construction contributes retained dependency work.
3. Make `LandingPage` use the existing native `lazyRouteComponent` pattern so protected routes do not eagerly load public-page motion and components.
4. If password-dialog code remains unnecessarily eager, load that dialog when opened using existing Suspense/loading conventions.
5. Preserve route guards, parallel layout/page loading, password requirements, strength feedback, and the 72-byte UTF-8 limit.
6. Avoid arbitrary chunk configuration, dependency replacement, or raising the budget.

Acceptance and expected improvement:

- Initial JavaScript gzip <= **200,000 bytes**, at least 44,653 bytes below the current result.
- Protected routes do not request public-only motion code.
- Public matched-route resource totals also decrease; merely moving bytes outside the initial-graph calculation does not count.
- Target at least 20% median startup long-task reduction over repeated matching runs. Record remaining dominant work if this timing target is not achieved; do not claim it from byte savings alone.
- Existing lazy-loading, password, and protected-route tests remain green.

### P2 - Fix large address-picker interaction cost

**Priority:** High. **Impact:** Applicant address entry. **Complexity:** Medium. **Risk:** Medium.  
**Evidence:** reproducible 872-976 ms click events.

Affected areas:

- `frontend/src/components/ui/ComboBox.tsx:153`
- `frontend/src/components/ui/ComboBox.tsx:333`
- `frontend/src/components/ui/ComboBox.tsx:546`
- `frontend/src/components/common/PhilippineAddressFields.tsx`

Root causes include rendering every matching option and scrolling the highlighted item through a complete DOM list. The CPU profile also recorded substantial `scrollIntoView` work. Automation contributes some sampled CPU; use browser event durations and application-owned work for the final comparison.

Implementation:

1. Precompute normalized searchable text and duplicate-value counts when options change.
2. Resolve highlighted options by stable logical identity; avoid scanning every `<li>` during highlighting.
3. Add an opt-in windowed mode for the large, ungrouped barangay list. Keep existing behavior as the default for other ComboBox consumers.
4. Render visible rows plus overscan, keeping at most 60 options mounted. Preserve logical ordering and the complete searchable dataset. Use consistent row sizing for this ungrouped address mode; grouped and custom-entry consumers retain the existing rendering path.
5. Keep the active descendant mounted and scroll within the dropdown rather than scrolling the surrounding document unnecessarily. Preserve logical position/size announcements for windowed options.
6. Preserve numeric barangay matching, accents, postal-code matching, disabled saved values, custom-entry behavior, and dependent-field clearing.

Acceptance and expected improvement:

- Twenty repeated opening/typing/keyboard interactions under CPU 4x: interaction p95 <= **200 ms**.
- At least 70% reduction from the current median opening-click duration.
- No result truncation; all 897 logical options remain reachable.
- Correct Arrow keys, Enter, Escape, Tab, focus, selection announcements, and postal autofill. Preserve any existing Home/End behavior rather than silently changing it.
- Existing ComboBox and PhilippineAddressFields tests pass, with large-list browser coverage added.

### P3 - Render dashboard sections independently

**Priority:** High. **Impact:** slow or partially failing requests. **Complexity:** Medium. **Risk:** Low.  
**Evidence:** source-confirmed gates and delayed-response browser probe.

Affected areas:

- `frontend/src/pages/ta/TADashboard.tsx:47`
- `frontend/src/pages/applicant/ApplicantDashboard.tsx:56`
- Reuse the section-level pattern in `frontend/src/pages/admin/AdminDashboard.tsx`.

Implementation:

1. Keep dashboard navigation and headings available.
2. Give independent metrics, application lists, jobs, and SLA sections their own loading/error boundaries.
3. Retry only the failed section.
4. Reserve section dimensions to prevent layout shifts.
5. Distinguish pending/failed data from a genuine zero count.

Acceptance and expected improvement:

- With one endpoint delayed two seconds, unrelated successful sections appear before it completes.
- Successful sections render within **500 ms of their fixture response** under CPU 4x.
- Failure of one section does not hide successful sections.
- CLS remains <= **0.1**.
- Applicant application totals and TA SLA/business rules remain unchanged.
- This improves useful-content latency; do not describe it as a reduction in server response time.

### P4 - Bound TA queue, request, deployment, and suggestion workloads

**Priority:** High. **Impact:** growing operational history. **Complexity:** Medium-High. **Risk:** Medium.  
**Evidence:** complete-array requests and client-side slicing confirmed; Workforce full-queue request reproduced. Server latency remains unmeasured.

Affected frontend areas include MRFListPage, DeploymentsPage, InterviewsPage, WorkforcePage, RedeploymentQueuePage, and their API clients.

Affected backend areas include:

- `backend/src/services/employee/employee.service.ts:497`
- `backend/src/services/employee/redeployment-suggestions.service.ts:60`
- Corresponding TA services, controllers, routes, and validation schemas.

Implementation:

1. Add opt-in server pagination to remaining complete-list consumers. Preserve legacy response compatibility while callers migrate.
2. Use the existing paginated envelope: `items`, `total`, `page`, `pageSize`, `totalPages`. Validate positive pages and bound page size to at most 100 using existing schema conventions.
3. Move existing search, filters, and ordering before pagination; add a stable ID tie-breaker.
4. Preserve current visible page sizes: eight MRFs and ten deployment/redeployment records. Return authoritative summaries separately from page items.
5. Add a lightweight `GET /api/employees/redeployment-queue/summary` contract with stage counts for the badge. Register static routes before employee-ID routes. Non-redeployment Workforce tabs must use this instead of downloading the queue.
6. Gate assignment-dialog open-job loading on an actual assignment target.
7. Add an optional validated employee-ID batch parameter to the existing suggestions endpoint, capped at 25 unique IDs. Migrate the queue caller to request only its visible page and recheck eligibility server-side. Preserve the existing no-parameter contract until all callers are accounted for.
8. Preserve the existing 60-job candidate set, deterministic ranking, same-client precedence, and application/invitation exclusions.
9. Group placement history by employee once rather than repeatedly filtering the entire placement array.
10. Reuse existing 300 ms search debounce, cancellation signals, previous-page placeholders, and mutation invalidation.

The current suggestions path can perform up to **46,080,000 cosine dimension iterations** for 1,000 workers x 60 jobs x 768 dimensions. This is a workload calculation, not measured server time.

Acceptance and expected improvement:

- On 1,000-record fixtures, page payloads decrease by at least **90%** where the previous response contained the complete list.
- Non-redeployment tabs make **zero full-queue requests**.
- No assignment open-job request occurs before opening the dialog.
- Suggestions read and score only the bounded requested worker set. Target at least 80% CPU reduction for a ten-worker page compared with the full 1,000-worker baseline using the same 60 jobs.
- Requested workers receive identical rankings to the existing algorithm.
- Global totals, badge counts, filters, ownership, final-page access, and mutation behavior remain correct.
- MRF search interaction p95 <= **200 ms** under CPU 4x.
- Do not virtualize tables that already render only eight or ten rows.
- Pre-employment queue requests already have a 100-record cap; do not incorrectly classify that endpoint as unbounded or silently change its full-dataset summary semantics.

### P5 - Remove discarded analytics work, then optimize measured aggregation costs

**Priority:** High at large datasets. **Complexity:** Medium-High. **Risk:** Medium-High.  
**Evidence:** confirmed source-level workload; database timing unmeasured.

Affected areas:

- `backend/src/services/analytics/delivery.service.ts:375`
- `backend/src/services/analytics/delivery.service.ts:975`
- `backend/src/services/analytics/delivery.service.ts:1135`
- `backend/src/services/analytics/delivery.service.ts:1238`
- Analytics controllers and filter-option assembly.

Implementation:

1. Separate dashboard result assembly from report-detail construction. Dashboard callers currently discard detail that was still mapped, sorted, and allocated. Keep shared metric definitions so reports cannot drift.
2. Build per-request and per-owner aggregation maps in single passes.
3. Replace first-placement full-row processing with equivalent grouped minimum-date aggregation where parity tests establish identical results.
4. Measure query count, SQL duration, pool wait, payload size, CPU, and heap before further SQL changes.
5. Optimize remaining database aggregates only where that measurement identifies the bottleneck. Reuse filter-options queries without dropping complete option coverage or leaking role scope.
6. Keep exact totals. Never cap the data used to calculate dashboard metrics.
7. Avoid increasing query concurrency blindly: the configured pool maximum is 20 per backend process.

Acceptance and expected improvement:

- Dashboard requests execute **zero report-detail construction**.
- Deep-equal dashboard and export results for representative parity fixtures.
- At least **25% CPU or peak-allocation reduction** on the large synthetic workload before retaining structural optimization beyond removal of discarded work.
- Preserve Manila date boundaries, historical/current distinctions, repeated application attempts, ownership, unassigned work, and actual-start semantics.
- Establish real API p50/p95 on disposable or approved staging data before making a production improvement claim.

### P6 - Remove global returning-ID materialization and photo N+1 work

**Priority:** Medium. **Complexity:** Medium. **Risk:** Medium.  
**Evidence:** confirmed query shapes; live latency unmeasured.

Affected areas:

- `backend/src/services/ta/ta.applications.service.ts:98`
- `backend/src/services/ta/ta.applications.service.ts:162`
- `backend/src/services/employee/employee.service.ts:390`
- `backend/src/services/document/document.service.ts:167`

Implementation:

1. Replace the global returning-application ID collection with a scoped relational/parameterized `EXISTS` filter applied before count and pagination.
2. Preserve placement chronology, started-placement evidence, legacy ENDED fallback, repeat attempts, and same-client behavior.
3. For photo-bearing lists, batch-load distinct document metadata and applicable authorization information.
4. Batch signed URLs per bucket while preserving authorization checks, approved legacy URL validation, expiration, and null/error fallbacks.
5. Prefer existing summary responses when photos are unnecessary. Do not introduce per-row authorization queries while removing per-row document queries.

Acceptance and expected improvement:

- Returning filters no longer materialize all matching application IDs across the database.
- Cross-TA scope and result parity tests pass.
- Metadata/signing calls grow by batch or bucket, rather than by displayed row.
- Measure 1, 25, and 100 rows; target at least **80% fewer resolver calls** at 100 rows.
- Test duplicate references, missing documents, malformed references, unauthorized access, and partial storage failures.
- No public caching of private documents or weakening of access checks.

### P7 - Bound embedding tail latency and coalesce cold batches

**Priority:** Medium. **Complexity:** Medium. **Risk:** Medium.  
**Evidence:** embedding calls lack the content-generation path's explicit deadline; cold batch misses can duplicate work.

Affected areas:

- `backend/src/services/scoring/embedding.service.ts:62`
- `backend/src/services/scoring/embedding.service.ts:123`
- `backend/src/utils/gemini.ts`

Implementation:

1. Extend existing timeout/cancellation conventions to embedding calls.
2. Use a ten-second provider deadline consistent with the existing content-generation default.
3. Ensure timeout or cancellation releases capacity and follows existing retry/fallback workflow semantics. Do not release a provider slot while an uncancelled underlying request remains active.
4. Publish pending per-key promises before cold batch submission so overlapping callers share work.
5. Preserve model/task/dimension cache keys, input order, 768 dimensions, normalization, bounded cache size, and failure eviction.

Acceptance and expected improvement:

- A never-settling cancellable provider mock fails within the deadline plus **one second** of scheduling tolerance.
- Provider slots remain usable after timeout, with no hidden overlapping requests exceeding capacity.
- Concurrent identical cold inputs cause one provider computation per unique cache key.
- Retry, cancellation, malformed responses, and ranking parity tests pass.
- Repair stale Gemini mocks before relying on the older embedding unit suite; its mock currently omits `withGeminiCapacity`.

### P8 - Reduce export and backup memory only after isolated measurement

**Priority:** Medium. **Complexity:** High. **Risk:** High.  
**Evidence:** full-data materialization confirmed; peak RSS and operational impact unmeasured.

Affected areas:

- `backend/src/services/analytics/export.service.ts:593`
- `backend/src/services/admin/backup-tables.ts:66`
- `backend/src/services/admin/backup.service.ts:217`
- `backend/src/services/admin/backup.service.ts:453`

Implementation order:

1. Benchmark exports and backups against disposable large datasets, recording peak RSS, event-loop delay, duration, and row counts.
2. Make PDF model construction format-aware so it does not fetch Excel-only sections.
3. Bound PDF detail retrieval to printed rows while preserving exact totals and existing truncation notices.
4. Keep XLSX complete; do not silently truncate it.
5. Replace deep backup OFFSET traversal with stable keyset traversal, including composite keys.
6. Introduce streaming serialization/compression/encryption/upload only if measured memory savings justify the complexity.
7. Preserve encryption envelopes, checksums, retry/progress behavior, model allowlists, restore limits, and complete row coverage.
8. Do not introduce a long WAN transaction merely to change backup traversal. Preserve and document the existing consistency contract; current separate page queries do not establish a transaction-consistent snapshot.

Acceptance and expected improvement:

- PDF does not fetch sections excluded from PDF.
- Export totals and XLSX contents remain identical.
- Memory changes must reduce peak RSS by at least **30%** on the fixed large benchmark.
- Disposable backup/restore round trips preserve all rows and composite keys. Exercise concurrent writes, page retries, disconnects, and large JSON fields.
- Created backups respect supported restore limits: inspect current compressed-size, expanded-size, and row limits before changing collection.
- No live backup, restore, or shared-database mutation is authorized by this plan.

### P9 - Improve analytics tab responsiveness without losing state

**Priority:** Medium. **Complexity:** Medium. **Risk:** Medium.  
**Evidence:** measured tab-click cost; precise React attribution still required.

Affected areas:

- `frontend/src/components/analytics/OperationsWorkspace.tsx:74`
- Admin/TA analytics pages and expensive child panels.

Implementation:

1. Capture a React profiling build trace for tab switching with 1,000 request rows and 24 recruiters.
2. Identify which commits consume the interaction time.
3. Preserve mounted-tab search, filters, and page state. Existing tests explicitly protect this behavior.
4. Isolate confirmed expensive panels from unrelated tab-state updates using stable props and callbacks.
5. Consider lazy first mounting of unused panels only if their state-retention contract remains intact.
6. Add cancellation-signal plumbing for replaced analytics requests.

Do not introduce blanket memoization or replace the chart implementation. The chart-mode button and steady-scroll probes did not establish a chart-rendering bottleneck.

Acceptance and expected improvement:

- Tab-switch interaction p95 <= **200 ms** over 20 measured interactions.
- At least 30% reduction in the identified expensive commit.
- Filters, pagination, keyboard navigation, drill-down actions, and selected recruiter state survive tab switching.
- Repeated filter changes cancel superseded requests.

React's normal production build disables Profiler timing; use a deliberate profiling build for attribution and normal production builds for final comparison. See [React Profiler documentation](https://react.dev/reference/react/Profiler).

### P10 - Reduce public image transfer; treat font changes as an experiment

**Priority:** Medium. **Complexity:** Low-Medium. **Risk:** Low for images, Medium for fonts.

Affected areas include IndustryMosaic, public logos, `frontend/index.html`, and `frontend/src/index.css`.

Implementation:

1. Generate appropriately sized WebP image variants from existing assets using build-time tooling.
2. Preserve source images, crop positions, dimensions, alt text, and responsive layout.
3. Replace the 36 KB favicon photograph with a small favicon asset.
4. Target the resources actually requested during the landing-page benchmark.
5. Investigate font subsetting separately. Preserve Filipino characters, currency symbols, and the existing 112% display width.
6. Keep a font change only if it saves at least 25% of font transfer without visible typography or layout regressions.

Acceptance and expected improvement:

- Observed landing image bytes <= **250,000**, versus 509,883 currently, using the same observation conditions.
- Favicon <= **5 KB**.
- No crop, logo-quality, missing-glyph, or CLS regression.
- CSS remains below **50 KB gzip**.
- Do not remove image dimensions or add runtime image-processing dependencies.

### P11 - Keep compatibility repair and index changes behind evidence gates

**Priority:** Medium for compatibility investigation; Low for speculative index/ANN work. Implementation deferred until evidence and approvals exist.

Confirmed read-time repair exists in:

- `backend/src/services/ta/ta.compliance.service.ts:108`
- `backend/src/services/ta/ta.applications.service.ts:514`

Before removing it:

1. Inventory affected legacy records using read-only queries.
2. Prepare an idempotent backfill preserving template precedence and historical deadlines.
3. Validate against disposable copies.
4. Obtain explicit approval before applying shared-database changes.
5. Only then move persistent creation to authoritative transitions and make GET fallbacks read-only.

Acceptance: legacy requirements/deadlines remain correct, existing records are preserved, and post-backfill GET paths issue zero repair writes. Measure request/write reduction against the inventoried workload; no speedup percentage is established yet.

For indexing:

- Capture actual selective query plans and existing deployed indexes.
- Use representative list, returning-worker, interview, analytics, and similarity workloads.
- Notification indexes already exist in schema definitions; migration files alone do not establish whether they are deployed.
- Do not add speculative indexes or approximate vector search. Preserve deterministic rankings and eligibility semantics.
- Retain a proposed index only after a representative benchmark shows at least **20% query-latency improvement** without material write regression.

`EXPLAIN ANALYZE` executes the statement. Restrict it to appropriate SELECT workloads on disposable or approved staging data. See [PostgreSQL EXPLAIN guidance](https://www.postgresql.org/docs/current/using-explain.html).

### P12 - Investigate retained memory and preserve regression tooling

**Priority:** Medium for memory investigation; High for maintaining measurement coverage.

Memory investigation:

1. Repeat 100 SPA navigation cycles without audit arrays, CPU sampling, or accumulating trace data.
2. Capture heap snapshots after warmup and after the final forced GC.
3. Compare retained DOM, listeners, timers, router state, query entries, and detached component trees.
4. Change application code only after identifying an application-owned retention path.
5. Require final post-GC heap to plateau: no more than **10% growth between cycles 20 and 100** for the fixed workload, or document intentional bounded retention.

Regression tooling:

- Current root and frontend ignore rules exclude scripts, test files, E2E suites, and configuration.
- The audited bundle script and selected regression tests are present locally but were not listed by `git ls-files`.
- Add narrow exceptions for the selected performance harness, relevant configs, and regression tests when implementing. Preserve unrelated ignore changes; do not broadly unignore all artifacts.
- Add a PR performance job using existing dependencies and lockfiles. Do not couple it to deployment.
- Acceptance: a fresh checkout can run the tracked bundle and focused performance regression checks; a deliberate budget violation fails the PR job.

## 4. Validation and measurable targets

### Shared measurement rules

- Rebaseline immediately before each task using the same build, fixtures, browser, CPU/network settings, and sample window.
- Change one performance concern at a time.
- Record before/after median, distribution, payload bytes, long tasks, and correctness results.
- Use at least 20 interaction samples for p95. Do not report p95 from three or five page loads.
- Count every `.js` resource, including module-preload entries; filtering only `initiatorType === "script"` undercounts JavaScript.
- Separate API/server latency from fixture delay and browser rendering.
- Repeat near-threshold results. Revert complexity that produces no improvement beyond measurement noise.
- Record retained and reverted experiments so unsuccessful optimizations are not repeatedly attempted.
- Test real HTTP caching separately from routed fixtures. Verify deployed immutable hashed assets and revalidated HTML before changing already-present cache configuration.

### Overall targets

| Metric | Target and interpretation |
| --- | --- |
| Initial JavaScript gzip | <= **200,000 bytes** |
| Main CSS gzip | < **50 KB** |
| Laboratory LCP | <= **2.5 seconds** under the agreed representative profile; first require reproducible improvement beyond baseline variance |
| Targeted picker, search, report tabs | Interaction p95 <= **200 ms** |
| CLS | <= **0.1** |
| Warm fixture-backed route transitions | <= **500 ms** |
| Small paginated staging reads | Initial target p95 <= **500 ms** |
| Aggregate staging dashboards | Initial target p95 <= **1,500 ms** |
| Landing image resources | <= **250,000 bytes** in matching samples |
| Favicon | <= **5 KB** |

Confirm or revise API targets only after real staging baselines identify database/network contribution. Field acceptance should eventually evaluate p75 LCP, INP, and CLS on deployed traffic; laboratory results alone cannot establish field Core Web Vitals. See [Core Web Vitals thresholds](https://web.dev/articles/defining-core-web-vitals-thresholds).

### Required functional scenarios

- Applicant jobs, Saved Jobs, applications, profile editing, address matching, document access, and processing/idle polling.
- TA ownership, combined filters, pagination, interview deadlines, compliance, deployment lifecycle, repeat applications, and same-client redeployment.
- Admin user search, audit date/limit validation, analytics totals, exports, and maintenance status.
- Notification token rotation, reconnect, scoped invalidation, and reconciliation polling.
- Empty results, slow responses, partial failures, cancellation, retries, and last-page changes.
- Mobile layout, keyboard focus, reduced motion, accessible list announcements, and all ten project HCI checks.

Preserve authentication/revocation checks, private API cache headers, signed-document authorization, deterministic scoring, actual-start/end rules, and existing hiring transitions. Keep real Turnstile credentials and verification behavior. Do not reactivate deployment promotion from planned contract dates.

### Verified commands to reuse

From repository root:

```powershell
node frontend/scripts/measure-bundle.mjs
```

From `frontend`:

```powershell
npm.cmd run typecheck
npm.cmd run build
npx.cmd vitest run src/components/ui/__tests__/ComboBox.test.tsx src/components/common/PhilippineAddressFields.test.tsx src/components/analytics/__tests__/AnalyticsWorkspace.test.tsx src/pages/applicant/__tests__/JobsPage.test.tsx src/lib/query-policies.test.ts
```

The focused frontend command passed **83 tests** during this audit. The production audit build used Vite with a temporary output directory; final implementation verification should run the normal build above as well.

From `backend`:

```powershell
npx.cmd tsc --noEmit
npx.cmd vitest run src/services/analytics/delivery.service.test.ts src/services/analytics/delivery.ownership.test.ts src/services/analytics/analytics.service.test.ts src/services/admin/backup-tables.test.ts src/services/applicant/saved-job.service.pagination.test.ts tests/security/bounded-work-queue.test.ts tests/security/embedding-retry.test.ts --fileParallelism=false --testTimeout=30000
```

The isolated backend command passed **82 tests**.

Do not run the entire backend suite blindly. Some tests create real database records, and server imports/startup can perform housekeeping. Inspect isolation first. Backend build invokes Prisma generation; use the read-only typecheck for audit refreshes and run generation/build only within an authorized implementation step.

### Reproducible browser harness requirements

1. Build current production source, then start preview on a dedicated localhost port.
2. Intercept all API requests and use backend-shaped fixtures; reject unexpected requests rather than allowing them to reach a real backend.
3. Use representative Applicant, TA, and Admin identities only within the isolated browser harness. Do not bypass or alter real login/Turnstile behavior.
4. Cover the ten baseline routes plus populated Admin analytics. Use 1,000 MRF/request rows, 24 recruiters, the real 897-option Manila list, and separate 1,000-worker/60-job backend suggestion benchmarks.
5. Collect LCP/CLS/long tasks and Event Timing from navigation start. Record endpoint completion and independently useful section visibility separately from first heading visibility.
6. Run CPU 4x localhost and CPU 4x with 150 ms latency, 1.6 Mbps down, and 750 Kbps up. Wait for relevant resources to settle before finalizing network samples.
7. Separate small-data route baselines, large-data interactions, and profiling builds. Do not compare their numbers interchangeably.
8. Run component tests, then existing loading-performance E2E tests, then new production-preview timing and request-budget checks. Existing development-server filename assertions do not substitute for production resource measurements.

## 5. Claude Code Execution Instructions

1. **Confirm the checkout.** Work in `C:\Users\cnico\OneDrive\Desktop\MEGS`. Read this document, AGENTS.md, and applicable development/frontend/HCI skills. Inspect current source and dirty changes before editing; line references identify the audited checkout and may move.
2. **Preserve existing work.** Do not reset the `.gitignore` change or assume audit-era source remains unchanged. This document already exists at the requested root path. Keep supporting documentation under the existing `docs/` hierarchy.
3. **Establish reproducible tooling.** Preserve the bundle check and add a production-preview Playwright harness using current backend-shaped fixtures. Save benchmark artifacts under ignored test-result storage. Track selected harness/configuration and regression tests through narrow ignore exceptions.
4. **Implement P1, then P2, then P3.** These address the strongest measured user-visible problems. Validate each independently before proceeding.
5. **Implement P4 in backend-to-frontend order.** Add validated compatible contracts first, then migrate consumers, then verify counts, rankings, ownership, and request budgets.
6. **Implement P5's discarded-detail removal first.** Treat further aggregation changes as measured experiments with output-parity tests.
7. **Implement P6 and P7 independently.** Preserve authorization and scoring semantics. Benchmark provider behavior with isolated mocks.
8. **Apply P9 and P10 only against their stated acceptance tests.** Retain existing state, typography, motion preferences, and responsive behavior.
9. **Measure before executing P8, P11, or memory changes in P12.** Their runtime impact or compatibility requirements need additional evidence. Prepare shared-system changes separately; obtain approval before migrations, backfills, live maintenance, or deployment.
10. **Run final verification.** Run frontend typecheck/build, bundle budget, focused and full frontend tests, safe backend suites, production-preview browser workflows, and the ten-point HCI checklist. Run database-sensitive tests only against a confirmed disposable database.
11. **Review the diff.** Verify preserved contracts, role scope, document privacy, error behavior, and hiring transitions. Use applicable review guidance before merging. Ensure new regression tooling is actually tracked.
12. **Report concrete results.** Update this plan with before/after measurements, test outcomes, retained/reverted experiments, and remaining staging/deployment work. Distinguish code completion, staging validation, migration application, and production verification.
13. **Stop at the acceptance conditions.** Do not add blanket memoization, replace core libraries, introduce infrastructure, remove security checks, or redesign workflows without measured need. Do not mark an unmeasured optimization complete.

### Final handoff checklist

- [ ] Each implemented task includes matching before/after evidence and relevant regression coverage.
- [ ] Public, Applicant, TA, and Admin loading/interaction checks pass.
- [ ] Bundle and resource budgets pass without merely hiding matched-route transfer.
- [ ] Backend contracts, exact counts, deterministic ranking, and ownership remain correct.
- [ ] Real authentication, Turnstile, signed-document checks, and private caching rules remain intact.
- [ ] Existing dirty changes are preserved; intended harness/tests are tracked.
- [ ] Reverted or inconclusive experiments are recorded.
- [ ] Unmeasured staging/production work and unapplied migrations are explicitly listed.
- [ ] No deployment, shared backfill, or live maintenance is performed without explicit authorization.
