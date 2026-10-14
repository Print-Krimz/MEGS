import { describe, expect, it } from "vitest";
import { BoundedWorkQueue } from "../../src/security/bounded-work-queue.js";

describe("resume producer backpressure has no total-count limit", () => {
  it("waits for capacity and completes 151 tasks without rejection or duplication", async () => {
    const queue = new BoundedWorkQueue(1, 1);
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const completed: number[] = [];
    const admissions = Array.from({ length: 151 }, (_, id) => queue.admit(async () => {
      if (id === 0) await gate;
      completed.push(id);
    }));
    await new Promise(resolve => setTimeout(resolve, 5));
    expect(queue.pending).toBe(1);
    expect(queue.size).toBe(1);
    expect(completed).toHaveLength(0);
    release();
    const admitted = await Promise.all(admissions);
    await Promise.all(admitted.map(item => item.completion));
    await queue.onIdle();
    expect(completed).toEqual(Array.from({ length: 151 }, (_, id) => id));
  });
});
