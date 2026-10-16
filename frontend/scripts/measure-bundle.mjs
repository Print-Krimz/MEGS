import { gzipSync } from "node:zlib";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const MAX_INITIAL_GZIP_BYTES = 200_000;
const result = await build({
  root: projectRoot,
  configFile: resolve(projectRoot, "vite.config.ts"),
  build: { write: false },
});

const outputs = (Array.isArray(result) ? result : [result]).flatMap((item) =>
  "output" in item ? item.output : [],
);
const chunks = outputs.filter((item) => item.type === "chunk");
const chunksByName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
const pending = chunks.filter((chunk) => chunk.isEntry).map((chunk) => chunk.fileName);
const initialChunks = new Map();

while (pending.length > 0) {
  const fileName = pending.pop();
  if (!fileName || initialChunks.has(fileName)) continue;

  const chunk = chunksByName.get(fileName);
  if (!chunk) continue;

  initialChunks.set(fileName, chunk);
  pending.push(...chunk.imports);
}

if (initialChunks.size === 0) {
  throw new Error("Vite did not produce a JavaScript entry chunk.");
}

const forbiddenModule = /(?:^|[/\\])(?:leaflet|geo-data\.ts|ncr-(?:psgc|postal)-reference\.json)(?:[/\\.]|$)/i;
const unexpectedModules = [...initialChunks.values()].flatMap((chunk) =>
  Object.keys(chunk.modules)
    .filter((moduleId) => forbiddenModule.test(moduleId))
    .map((moduleId) => `${chunk.fileName}: ${moduleId}`),
);

const rawBytes = [...initialChunks.values()].reduce((total, chunk) => total + Buffer.byteLength(chunk.code), 0);
const gzipBytes = [...initialChunks.values()].reduce(
  (total, chunk) => total + gzipSync(Buffer.from(chunk.code)).byteLength,
  0,
);

console.log(`Initial JS chunks: ${initialChunks.size}`);
console.log(`Initial JS raw: ${rawBytes.toLocaleString("en-US")} bytes`);
console.log(`Initial JS gzip: ${gzipBytes.toLocaleString("en-US")} bytes`);
console.log("Initial chunk files:");
for (const chunk of initialChunks.values()) {
  console.log(`  ${chunk.fileName} (${Buffer.byteLength(chunk.code).toLocaleString("en-US")} raw)`);
}

let hasBudgetFailure = false;

if (gzipBytes > MAX_INITIAL_GZIP_BYTES) {
  console.error(`Initial JS gzip budget exceeded: ${gzipBytes} > ${MAX_INITIAL_GZIP_BYTES} bytes.`);
  hasBudgetFailure = true;
}

if (unexpectedModules.length > 0) {
  console.error("Unexpected deferred modules found in the initial JS graph:");
  for (const module of unexpectedModules) console.error(`  ${module}`);
} else {
  console.log("Deferred module check: Leaflet and address-reference data are absent from the initial JS graph.");
}

if (hasBudgetFailure || unexpectedModules.length > 0) process.exitCode = 1;
