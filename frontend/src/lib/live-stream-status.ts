import { useSyncExternalStore } from "react";

let connected = false;
const listeners = new Set<() => void>();

/** Written by the notification stream; read by queries that poll less while it is open. */
export function setLiveStreamConnected(value: boolean): void {
  if (connected === value) return;
  connected = value;
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export function useLiveStreamConnected(): boolean {
  return useSyncExternalStore(subscribe, () => connected, () => false);
}
