import { describe, expect, it } from "vitest";
import { BoundedWorkQueue } from "../../src/security/bounded-work-queue.js";

describe("scoring queue producer backpressure", () => {
  it("serializes concurrent admissions, keeps the pending cap and completes every accepted task", async () => {
    const queue = new BoundedWorkQueue(2, 3);
    let release!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    const completed: number[] = [];
    let admissions = 0; let maximumPending = 0;
    const producers = Array.from({ length: 25 }, (_, id) => queue.admit(async () => {
      await barrier; completed.push(id);
    }).then(result => { admissions++; maximumPending = Math.max(maximumPending, queue.size); return result; }));
    await new Promise(resolve => setTimeout(resolve, 5));
    expect(queue.pending).toBe(2); expect(queue.size).toBe(3); expect(admissions).toBe(5);
    release();
    const admitted = await Promise.all(producers);
    await Promise.all(admitted.map(result => result.completion));
    await queue.onIdle();
    expect(maximumPending).toBeLessThanOrEqual(3);
    expect(completed.sort((a, b) => a - b)).toEqual(Array.from({ length: 25 }, (_, id) => id));
  });
  it("preserves task rejection for awaiting callers and remains usable afterward", async () => {
    const queue = new BoundedWorkQueue(1, 2);
    const failed = await queue.admit(async () => { throw new Error("synthetic failure"); });
    await expect(failed.completion).rejects.toThrow("synthetic failure");
    let ran = false;
    const next = await queue.admit(async () => { ran = true; });
    await next.completion; await queue.onIdle(); expect(ran).toBe(true);
  });
});
