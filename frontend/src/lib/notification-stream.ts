import { fetchEventSource, type EventSourceMessage } from "@microsoft/fetch-event-source";

class StopStream extends Error {}

// A fresh Bearer header is read for each connection. HTTP auth failures stop until
// the session changes; transient failures have a finite, increasing retry budget.
export function connectNotificationStream(options: {
  url: string;
  getToken: () => string | null;
  onMessage: (event: EventSourceMessage) => void;
  subscribeSession: (restart: () => void) => () => void;
  /** Runs when the stream opens again after a drop; events sent while it was down are lost, so refetch. */
  onReconnect?: () => void;
  transport?: typeof fetchEventSource;
}): () => void {
  let disposed = false;
  let controller: AbortController | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;
  const transport = options.transport || fetchEventSource;
  const start = () => {
    generation += 1;
    const currentGeneration = generation;
    controller?.abort();
    clearTimeout(retryTimer);
    let hasOpened = false;
    const attempt = async (failureCount: number): Promise<void> => {
      const token = options.getToken();
      if (disposed || !token || generation !== currentGeneration) return;
      const currentController = new AbortController();
      controller = currentController;
      let opened = false;
      try {
        await transport(options.url, {
          headers: { Authorization: `Bearer ${token}` },
          signal: currentController.signal,
          onopen: async (response) => {
            if (response.status === 401 || response.status === 403) throw new StopStream();
            if (!response.ok || !response.headers.get("content-type")?.startsWith("text/event-stream")) {
              throw new Error("Notification stream unavailable");
            }
            opened = true;
            if (hasOpened) options.onReconnect?.();
            hasOpened = true;
          },
          onmessage: options.onMessage,
          onclose: () => { throw new Error("Notification stream closed"); },
          onerror: (error) => { throw error; },
        });
      } catch (error) {
        // A stream that opened was healthy, so its eventual close starts a fresh retry budget.
        // Without this reset the budget is spent over the page's lifetime and the stream stays dead.
        const failures = opened ? 0 : failureCount;
        if (error instanceof StopStream || disposed || currentController.signal.aborted ||
          currentGeneration !== generation || failures >= 4) return;
        retryTimer = setTimeout(() => { void attempt(failures + 1); }, 1000 * 2 ** failures);
      }
    };
    void attempt(0);
  };
  const unsubscribe = options.subscribeSession(start);
  start();
  return () => {
    disposed = true;
    generation += 1;
    clearTimeout(retryTimer);
    controller?.abort();
    unsubscribe();
  };
}
