import { useEffect, useRef, useState } from "react";
import { fetchEventSource } from "@microsoft/fetch-event-source";

class StopStream extends Error {}
class StreamClosed extends Error {}
class RetryableResponse extends Error {
  constructor(public retryAfterMs: number) {
    super("Stream unavailable");
  }
}

const MAX_RETRY_AFTER_S = 60;
const retryAfterMs = (response: Response): number => {
  const seconds = Number(response.headers.get("retry-after"));
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, MAX_RETRY_AFTER_S) * 1000 : 0;
};

const DEBOUNCE_MS = 300;
const MAX_FAILURES = 4;

interface Options {
  url: string;
  headers: Record<string, string>;
  enabled: boolean;
  onChange: () => void;
}

/**
 * Listens to a server-sent-events stream that carries no data, only "something changed".
 * Each `changed` event (and each return to the tab) calls onChange so the page refetches.
 * Polling stays on as the safety net, so a refused or dead stream is never fatal.
 */
export function useLiveRefresh({ url, headers, enabled, onChange }: Options): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const headersKey = JSON.stringify(headers);

  useEffect(() => {
    if (!enabled) return;
    const streamHeaders = JSON.parse(headersKey) as Record<string, string>;
    let disposed = false;
    let stopped = false; // the server refused the stream: do not try again
    let running = false;
    let controller: AbortController | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let changeTimer: ReturnType<typeof setTimeout> | undefined;

    const notifyChange = () => {
      clearTimeout(changeTimer);
      changeTimer = setTimeout(() => onChangeRef.current(), DEBOUNCE_MS);
    };

    const connect = async (failures: number): Promise<void> => {
      if (disposed || stopped || running) return;
      if (document.visibilityState === "hidden") return;
      running = true;
      const current = new AbortController();
      controller = current;
      let nextFailures = failures;
      let delay: number | null = null;
      try {
        await fetchEventSource(url, {
          headers: streamHeaders,
          signal: current.signal,
          openWhenHidden: false,
          onopen: async (response) => {
            if (response.status === 404) throw new StopStream();
            if (!response.ok || !response.headers.get("content-type")?.startsWith("text/event-stream")) {
              throw new RetryableResponse(retryAfterMs(response));
            }
          },
          onmessage: (event) => {
            if (event.event === "ready") {
              nextFailures = 0;
              setConnected(true);
              notifyChange(); // catch up on anything missed before the stream opened
            } else if (event.event === "changed") {
              notifyChange();
            }
          },
          onclose: () => {
            throw new StreamClosed();
          },
          onerror: (error) => {
            throw error;
          },
        });
      } catch (error) {
        if (error instanceof StopStream) stopped = true;
        else if (error instanceof StreamClosed) delay = 0;
        else if (!current.signal.aborted) {
          nextFailures += 1;
          if (nextFailures <= MAX_FAILURES) {
            const minimum = error instanceof RetryableResponse ? error.retryAfterMs : 0;
            delay = Math.max(1000 * 2 ** (nextFailures - 1), minimum);
          }
        }
      }
      if (controller !== current) return; // paused or replaced while waiting
      running = false;
      controller = undefined;
      if (disposed || current.signal.aborted) return;
      setConnected(false);
      if (delay === null) return;
      retryTimer = setTimeout(() => void connect(delay === 0 ? 0 : nextFailures), delay);
    };

    const pause = () => {
      clearTimeout(retryTimer);
      controller?.abort();
      controller = undefined;
      running = false;
      setConnected(false);
    };
    const resume = () => {
      if (disposed || stopped) return;
      clearTimeout(retryTimer);
      notifyChange(); // catch up on whatever happened while away
      void connect(0);
    };
    const onVisibility = () => (document.visibilityState === "hidden" ? pause() : resume());

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", resume);
    void connect(0);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", resume);
      clearTimeout(retryTimer);
      clearTimeout(changeTimer);
      controller?.abort();
      setConnected(false);
    };
  }, [url, headersKey, enabled]);

  return { connected: enabled && connected };
}
