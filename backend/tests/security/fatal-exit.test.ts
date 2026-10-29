import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// No database is touched: the fixture imports only the error and response helpers.
const fixture = fileURLToPath(new URL("./fixtures/fatal-process.ts", import.meta.url));
const run = (mode: string) => spawnSync(process.execPath, ["--import", "tsx", fixture, mode], { encoding: "utf8", timeout: 20_000 });

describe("fatal process errors", () => {
  it.each(["uncaught", "rejection"])("logs one safe diagnostic and exits nonzero on %s", (mode) => {
    const result = run(mode);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/reference [a-f0-9-]{36}/);
    expect(result.stderr + result.stdout).not.toMatch(/fake-secret|fake-token|secret/);
  });
  it("keeps a handled request error recoverable", () => {
    const result = run("handled");
    expect(result.status).toBe(0);
    expect(result.stderr).toMatch(/reference [a-f0-9-]{36}/);
  });
});
