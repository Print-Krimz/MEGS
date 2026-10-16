#!/usr/bin/env node
/**
 * Rolls up the interleaved network-profile samples (PERF_NETWORK=slow) into one table.
 *
 * Reads frontend/test-results/perf/network/<build>-s<n>/network.json and writes network/summary.json.
 * Usage (from frontend/): node perf/summarize-network.mjs [builds=baseline,after] [samples=5]
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "test-results", "perf", "network");
const builds = (process.argv[2] ?? "baseline,after").split(",");
const samples = Number(process.argv[3] ?? 5);
const routes = ["/", "/app/jobs"];

function stats(values) {
  const v = values.filter((x) => typeof x === "number").sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
  return { n: v.length, median: mid, min: v[0], max: v[v.length - 1], values: v };
}

const data = {};
for (const build of builds) {
  data[build] = {};
  for (const route of routes) {
    const rows = [];
    for (let s = 1; s <= samples; s += 1) {
      const file = path.join(root, `${build}-s${s}`, "network.json");
      if (!existsSync(file)) continue;
      const json = JSON.parse(readFileSync(file, "utf8"));
      if (json.skipped) continue;
      const r = json.results?.[route];
      if (r) rows.push({ sample: s, ...r });
    }
    data[build][route] = {
      samples: rows.length,
      lcpMs: stats(rows.map((r) => r.lcpMs)),
      cls: stats(rows.map((r) => r.cls)),
      jsCount: stats(rows.map((r) => r.jsCount)),
      jsTransferBytes: stats(rows.map((r) => r.jsTransferBytes)),
      jsRawBytes: stats(rows.map((r) => r.jsRawBytes)),
      imageBytes: stats(rows.map((r) => r.imageBytes)),
      fontBytes: stats(rows.map((r) => r.fontBytes)),
      longtaskTotalMs: stats(rows.map((r) => r.longtaskTotalMs)),
      jsMinDurationMs: stats(rows.map((r) => r.jsMinDurationMs)),
      apiRequests: stats(rows.map((r) => r.apiRequests)),
      pageErrors: rows.reduce((t, r) => t + (r.pageErrors ?? 0), 0),
      unexpectedApi: rows.flatMap((r) => r.unexpectedApi ?? []),
      lcpSequence: rows.map((r) => ({ sample: r.sample, lcpMs: r.lcpMs })),
    };
  }
}

writeFileSync(path.join(root, "summary.json"), `${JSON.stringify({ samplesPerBuild: samples, builds, data }, null, 2)}\n`, "utf8");

const fmt = (s) => (s ? `${Math.round(s.median)} [${Math.round(s.min)}-${Math.round(s.max)}] n=${s.n}` : "n/a");
const fmtBytes = (s) => (s ? `${Math.round(s.median)} [${Math.round(s.min)}-${Math.round(s.max)}]` : "n/a");
console.log("route\tbuild\tLCP ms median [min-max]\tCLS median\tJS transfer B\tJS raw B\tJS files\timages B\tfonts B\tlongtask ms\tJS min resource ms\tpage errors\tunexpected API");
for (const route of routes) {
  for (const build of builds) {
    const d = data[build][route];
    console.log(
      [
        route,
        build,
        fmt(d.lcpMs),
        d.cls ? d.cls.median.toFixed(4) : "n/a",
        fmtBytes(d.jsTransferBytes),
        fmtBytes(d.jsRawBytes),
        d.jsCount ? d.jsCount.median : "n/a",
        fmtBytes(d.imageBytes),
        fmtBytes(d.fontBytes),
        d.longtaskTotalMs ? Math.round(d.longtaskTotalMs.median) : "n/a",
        d.jsMinDurationMs ? Math.round(d.jsMinDurationMs.min) : "n/a",
        d.pageErrors,
        d.unexpectedApi.length,
      ].join("\t"),
    );
  }
}
for (const route of routes) {
  for (const build of builds) {
    console.log(`${route} ${build} LCP sequence: ${data[build][route].lcpMs ? data[build][route].lcpMs.values.join(", ") : "n/a"} (sorted)`);
  }
}
