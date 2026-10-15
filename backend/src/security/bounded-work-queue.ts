import PQueue from "p-queue";

// Producers wait for an admission slot rather than accumulating queue entries
// or silently losing already accepted work. Serialize the check plus add so
// multiple producers cannot all observe the same remaining capacity.
export class BoundedWorkQueue {
  private readonly queue: PQueue;
  private admissionTail: Promise<void> = Promise.resolve();
  constructor(concurrency: number, private readonly pendingLimit = 100) {
    this.queue = new PQueue({ concurrency });
  }
  admit(task: () => Promise<void>): Promise<{ completion: Promise<void> }> {
    const admission = this.admissionTail.then(async () => {
      await this.queue.onSizeLessThan(this.pendingLimit);
      const completion = this.queue.add(task).then(() => undefined);
      // Attach immediately: background producers need not await completion.
      // Awaiting callers still receive the original task rejection.
      void completion.catch(() => undefined);
      return { completion };
    });
    this.admissionTail = admission.then(() => undefined, () => undefined);
    return admission;
  }
  async onIdle(): Promise<void> {
    await this.admissionTail;
    await this.queue.onIdle();
  }
  get size(): number { return this.queue.size; }
  get pending(): number { return this.queue.pending; }
}
