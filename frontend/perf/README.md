# Production-preview performance harness

Playwright measurements against a built `dist` folder, with every API answered from fixtures.
Nothing reaches a real backend. Local dev server and port 5173 are not used.

## Run

From `frontend/`, after installing dependencies:

```powershell
$env:PERF_DIST = "C:\path\to\dist"      # production build output to measure
$env:PERF_LABEL = "after"               # folder name under test-results/perf/
npx.cmd playwright test -c perf/perf.config.ts
```

Bash equivalent:

```bash
PERF_DIST=/path/to/dist PERF_LABEL=after npx playwright test -c perf/perf.config.ts
```

- `PERF_DIST` is required. The harness never rebuilds from source.
- `vite preview` serves `PERF_DIST` on `127.0.0.1:4173` (strict port). Stop anything already on 4173 first.
- Run a single scenario with `-g`, for example `-g "MRF search"`.

Opt-in modes (default runs are unchanged):

- `PERF_NETWORK=slow`: adds the network profile to every session. CDP throttles real requests (150 ms latency, 1.6 Mbps down, 750 Kbps up). Routed API fixtures never touch the network, so each one also waits 150 ms plus its body's download time. Run the network scenario with `-g "network profile"`. Use one run per sample so builds can be interleaved.
- `PERF_MEMORY=1`: switches the config to `memory.perf.ts` (P12). Applicant dashboard and Explore Jobs navigated by nav-link clicks, forced GC at each checkpoint, heap snapshots at cycle 20 and the last cycle. `PERF_MEMORY_CYCLES` (default 100). Harness PerformanceObserver stores are off. Output goes to `test-results/perf/memory/`. Diff snapshots with `node --max-old-space-size=8192 perf/heap-diff.mjs <early> <late> --out diff.json`.
- `node perf/summarize-network.mjs [builds] [samples]` rolls up the network samples (`test-results/perf/network/<build>-s<n>/`).

To make an "after" build without touching the default output folder:

```powershell
npx.cmd vite build --outDir "$env:TEMP\megs-after-dist" --emptyOutDir
```

## Output

Files go to `frontend/test-results/perf/<label>/` (ignored by git):

| File | Contents |
| --- | --- |
| `bundle.json` | Initial JS (entry plus modulepreload list in `index.html`): raw and gzip bytes, main CSS |
| `routes.json` | 10 routes x 5 fresh contexts: LCP, CLS, long tasks, `.js` count and bytes, image and font bytes, per-run detail |
| `landing.json` | Anonymous `/`: image bytes (with favicon) and font bytes, after 10 s settling and after scrolling |
| `address-picker.json` | Manila barangay ComboBox: 20 open clicks, typing and ArrowDown samples, mounted option count |
| `mrf-search.json` | `/ta/mrfs` with 1,000 records: keystroke durations |
| `admin-analytics.json` | `/admin/analytics` with 1,000 rows and 24 recruiters: 20 tab clicks |
| `ta-dashboard-delay.json` | `/ta` with the compliance endpoint delayed 2,000 ms |
| `applicant-dashboard-delay.json` | `/app` with one endpoint delayed 2,000 ms, in two variants |
| `workforce.json` | Redeployment-queue requests per Workforce tab, and payload bytes at 1,000 rows |
| `summary.json` | Concise roll-up of the above |

Required scenarios fail the run on any exception, unexpected `/api/` request (no fixture), page or console error, missing metric, or a stale readiness check, and are recorded as `{"failed": "<reason>"}`. The bundle scenario also fails when initial JS (HTML-listed entry and preloads plus every statically imported chunk, recursively) exceeds 200,000 gzip bytes; `PERF_JS_GZIP_BUDGET` overrides the budget for gate checks. Readiness is the route's own visible h1 (`ROUTE_READY` in `harness.ts`). The only optional probe is the network profile, recorded as `{"optional": true, "skipped": "<reason>"}` when `PERF_NETWORK` is not set. A full run ends with a check that every required scenario produced evidence.

## How it measures

- CPU throttled 4x through CDP. Viewport 1440 x 900. Headless Chromium.
- Every request in the browser context is routed. Preview-origin files continue. Any `/api/` request gets a fixture (default delay 100 ms). Other requests are aborted and listed in the results.
- Fixture shapes follow the frontend API types. Requests carrying `page` or `pageSize` get the paginated envelope `{items,total,page,pageSize,totalPages}`. Requests without them get the legacy shape.
- Event Timing uses `durationThreshold: 16`. Interactions with no entry were below 16 ms. Medians and p95 treat those as 16 ms (upper bound). `p95LowerBound` treats them as 0 ms.
- p95 uses nearest rank. Route baselines use 5 runs and report median and range; they are not p95 values.
- Every `.js` resource counts, including module preloads.

## Not covered

- Network throttling only applies with `PERF_NETWORK=slow` (see above). Default runs are CPU-only.
- HTTP caching. Routed fixtures disable it, so these numbers are cold-cache.
- React Profiler attribution. Use a profiling build for that.
- Real API latency, database cost, login and Turnstile.
