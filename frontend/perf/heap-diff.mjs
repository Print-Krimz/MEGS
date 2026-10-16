#!/usr/bin/env node
/**
 * Summarises and diffs two V8 .heapsnapshot files (P12 memory investigation).
 *
 * Usage (from frontend/, large heaps need the old-space flag):
 *   node --max-old-space-size=8192 perf/heap-diff.mjs <early.heapsnapshot> <late.heapsnapshot> [--out diff.json] [--top 25] [--chains 3]
 *
 * Reports for the late snapshot relative to the early one:
 * - totals and detached DOM nodes (detachedness === 2) for each snapshot
 * - top constructors/types by self-size delta and by count delta (name-level, both snapshots)
 * - objects alive in late but not in early (matched by V8 object id): the retained growth
 * - for the largest retained-growth keys, one shortest retainer path from GC roots (BFS over strong edges)
 *
 * Keys are "type|name". String-like and number types are grouped by type only.
 */
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const positional = [];
const flags = { out: null, top: 25, chains: 3 };
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === "--out") flags.out = args[++i];
  else if (args[i] === "--top") flags.top = Number(args[++i]);
  else if (args[i] === "--chains") flags.chains = Number(args[++i]);
  else positional.push(args[i]);
}
if (positional.length !== 2) {
  console.error("usage: heap-diff.mjs <early.heapsnapshot> <late.heapsnapshot> [--out file] [--top n] [--chains n]");
  process.exit(2);
}

const UNKEYED_TYPES = new Set(["string", "concatenated string", "sliced string", "number", "symbol", "bigint", "hidden"]);

function parse(file) {
  const snap = JSON.parse(readFileSync(file, "utf8"));
  const meta = snap.snapshot.meta;
  const nf = meta.node_fields;
  const ef = meta.edge_fields;
  const F = {
    type: nf.indexOf("type"),
    name: nf.indexOf("name"),
    id: nf.indexOf("id"),
    size: nf.indexOf("self_size"),
    edgeCount: nf.indexOf("edge_count"),
    det: nf.indexOf("detachedness"),
  };
  const EF = { type: ef.indexOf("type"), name: ef.indexOf("name_or_index"), to: ef.indexOf("to_node") };
  const g = {
    file,
    nodes: snap.nodes,
    edges: snap.edges,
    strings: snap.strings,
    nodeTypes: meta.node_types[0],
    edgeTypes: meta.edge_types[0],
    N: nf.length,
    E: ef.length,
    F,
    EF,
    nodeCount: snap.nodes.length / nf.length,
    hasDetachedness: F.det >= 0,
  };
  return g;
}

function node(g, i) {
  const b = i * g.N;
  return {
    type: g.nodeTypes[g.nodes[b + g.F.type]],
    name: g.strings[g.nodes[b + g.F.name]],
    id: g.nodes[b + g.F.id],
    size: g.nodes[b + g.F.size],
    det: g.hasDetachedness ? g.nodes[b + g.F.det] : 0,
  };
}

function keyOf(n) {
  return UNKEYED_TYPES.has(n.type) ? `(${n.type})` : `${n.type}|${n.name}`;
}

function summarise(g) {
  const byKey = new Map();
  const detachedByKey = new Map();
  let totalSize = 0;
  let detached = 0;
  let detachedSize = 0;
  for (let i = 1; i < g.nodeCount; i += 1) {
    const n = node(g, i);
    totalSize += n.size;
    const k = keyOf(n);
    const e = byKey.get(k) ?? { count: 0, size: 0 };
    e.count += 1;
    e.size += n.size;
    byKey.set(k, e);
    if (n.det === 2) {
      detached += 1;
      detachedSize += n.size;
      const d = detachedByKey.get(k) ?? { count: 0, size: 0 };
      d.count += 1;
      d.size += n.size;
      detachedByKey.set(k, d);
    }
  }
  return { byKey, detachedByKey, totalSize, detached, detachedSize, nodeCount: g.nodeCount - 1 };
}

/** BFS from the synthetic root (node 0) over non-weak edges. Gives one shortest retainer path per node. */
function retainerIndex(g) {
  const n = g.nodeCount;
  const firstEdge = new Float64Array(n + 1);
  for (let i = 0; i < n; i += 1) {
    firstEdge[i + 1] = firstEdge[i] + g.nodes[i * g.N + g.F.edgeCount] * g.E;
  }
  const parent = new Int32Array(n).fill(-1);
  const parentEdge = new Float64Array(n).fill(-1);
  const visited = new Uint8Array(n);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  queue[tail++] = 0;
  visited[0] = 1;
  while (head < tail) {
    const u = queue[head++];
    for (let e = firstEdge[u]; e < firstEdge[u + 1]; e += g.E) {
      if (g.edgeTypes[g.edges[e + g.EF.type]] === "weak") continue;
      const v = g.edges[e + g.EF.to] / g.N;
      if (!visited[v]) {
        visited[v] = 1;
        parent[v] = u;
        parentEdge[v] = e;
        queue[tail++] = v;
      }
    }
  }
  return { parent, parentEdge, visited };
}

function edgeLabel(g, e) {
  const et = g.edgeTypes[g.edges[e + g.EF.type]];
  const raw = g.edges[e + g.EF.name];
  if (et === "element") return `[${raw}]`;
  if (et === "hidden") return `(hidden ${raw})`;
  return String(g.strings[raw]).slice(0, 60);
}

function pathTo(g, index, target) {
  const steps = [];
  let t = target;
  let guard = 0;
  while (t > 0 && guard < 200) {
    const e = index.parentEdge[t];
    if (e < 0) break;
    const n = node(g, t);
    steps.push(`${edgeLabel(g, e)} -> ${n.type}:${String(n.name).slice(0, 60)} #${n.id}`);
    t = index.parent[t];
    guard += 1;
  }
  return steps.reverse();
}

const fmt = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

const early = parse(positional[0]);
const earlyIds = new Set();
const earlySummary = summarise(early);
for (let i = 1; i < early.nodeCount; i += 1) earlyIds.add(node(early, i).id);

const late = parse(positional[1]);
const lateSummary = summarise(late);

// Objects alive in late but not in early: matched by V8 object id.
const newByKey = new Map();
const newNodes = [];
for (let i = 1; i < late.nodeCount; i += 1) {
  const n = node(late, i);
  if (earlyIds.has(n.id)) continue;
  const k = keyOf(n);
  const e = newByKey.get(k) ?? { count: 0, size: 0 };
  e.count += 1;
  e.size += n.size;
  newByKey.set(k, e);
  newNodes.push({ i, key: k, size: n.size });
}
const keysAll = new Set([...earlySummary.byKey.keys(), ...lateSummary.byKey.keys()]);
const deltas = [...keysAll].map((k) => {
  const a = earlySummary.byKey.get(k) ?? { count: 0, size: 0 };
  const b = lateSummary.byKey.get(k) ?? { count: 0, size: 0 };
  return { key: k, countEarly: a.count, countLate: b.count, countDelta: b.count - a.count, sizeEarly: a.size, sizeLate: b.size, sizeDelta: b.size - a.size };
});
const bySize = [...deltas].sort((x, y) => y.sizeDelta - x.sizeDelta).slice(0, flags.top);
const byCount = [...deltas].sort((x, y) => y.countDelta - x.countDelta).slice(0, flags.top);
const newRanked = [...newByKey.entries()]
  .map(([key, v]) => ({ key, count: v.count, size: v.size }))
  .sort((x, y) => y.size - x.size);
const detachedKeys = [...new Set([...earlySummary.detachedByKey.keys(), ...lateSummary.detachedByKey.keys()])].map((k) => ({
  key: k,
  early: earlySummary.detachedByKey.get(k)?.count ?? 0,
  late: lateSummary.detachedByKey.get(k)?.count ?? 0,
})).sort((x, y) => y.late - x.late).slice(0, flags.top);

// Retainer chains for the largest retained-growth keys (sample: the largest objects of each key).
const index = retainerIndex(late);
const chains = [];
for (const entry of newRanked.slice(0, flags.chains)) {
  const samples = newNodes
    .filter((n) => n.key === entry.key)
    .sort((x, y) => y.size - x.size)
    .slice(0, 1);
  for (const s of samples) {
    chains.push({
      key: entry.key,
      size: s.size,
      reachable: index.visited[s.i] === 1,
      path: index.visited[s.i] === 1 ? pathTo(late, index, s.i) : [],
    });
  }
}

const result = {
  early: { file: early.file, nodes: earlySummary.nodeCount, selfSizeBytes: earlySummary.totalSize, detachedNodes: earlySummary.detached, detachedSizeBytes: earlySummary.detachedSize, hasDetachedness: early.hasDetachedness },
  late: { file: late.file, nodes: lateSummary.nodeCount, selfSizeBytes: lateSummary.totalSize, detachedNodes: lateSummary.detached, detachedSizeBytes: lateSummary.detachedSize, hasDetachedness: late.hasDetachedness },
  retainedNew: {
    nodes: newNodes.length,
    selfSizeBytes: newRanked.reduce((t, r) => t + r.size, 0),
    topBySize: newRanked.slice(0, flags.top),
  },
  topBySizeDelta: bySize,
  topByCountDelta: byCount,
  detachedByKey: detachedKeys,
  chains,
};

if (flags.out) writeFileSync(flags.out, `${JSON.stringify(result, null, 2)}\n`, "utf8");

const pad = (s, n) => String(s).slice(0, n).padEnd(n);
console.log(`early nodes=${result.early.nodes} self=${fmt(result.early.selfSizeBytes)} detached=${result.early.detachedNodes}`);
console.log(`late  nodes=${result.late.nodes} self=${fmt(result.late.selfSizeBytes)} detached=${result.late.detachedNodes}`);
console.log(`retained new (late, not early by id): nodes=${result.retainedNew.nodes} self=${fmt(result.retainedNew.selfSizeBytes)}`);
console.log("\nTop by self-size delta (late - early):");
console.log(`${pad("key", 60)} ${pad("countΔ", 9)} ${pad("sizeΔ", 12)}`);
for (const r of bySize) console.log(`${pad(r.key, 60)} ${pad(r.countDelta, 9)} ${pad(r.sizeDelta, 12)}`);
console.log("\nTop by count delta:");
for (const r of byCount) console.log(`${pad(r.key, 60)} ${pad(r.countDelta, 9)} ${pad(r.sizeDelta, 12)}`);
console.log("\nTop retained-new (not in early), by size:");
for (const r of result.retainedNew.topBySize) console.log(`${pad(r.key, 60)} ${pad(r.count, 9)} ${pad(r.size, 12)}`);
console.log("\nDetached DOM by key (early -> late):");
for (const r of detachedKeys) console.log(`${pad(r.key, 60)} ${pad(r.early, 9)} -> ${r.late}`);
console.log("\nRetainer chains (shortest, from GC roots, late snapshot):");
for (const c of chains) {
  console.log(`\n# ${c.key} sample size=${c.size} reachable=${c.reachable}`);
  for (const step of c.path.slice(-14)) console.log(`   ${step}`);
  if (c.path.length > 14) console.log(`   ... ${c.path.length - 14} earlier hops`);
}
