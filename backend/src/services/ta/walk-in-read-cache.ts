// Short-lived memory of bio-data reads, so a file read in the walk-in dialog is not sent to Gemini again when it is saved.
// Key: TA user id + file sha256. A restart or an expired entry only means the file is read again at save.
import type { ExtractedProfileData } from "../../utils/gemini.js";

const TTL_MS = 30 * 60 * 1000;
const MAX_ENTRIES = 500;

const store = new Map<string, { data: ExtractedProfileData; expiresAt: number }>();
const keyOf = (taUserId: string, sha256: string) => `${taUserId}:${sha256}`;

export const cacheWalkInRead = (taUserId: string, sha256: string, data: ExtractedProfileData): void => {
  const key = keyOf(taUserId, sha256);
  store.delete(key);
  store.set(key, { data, expiresAt: Date.now() + TTL_MS });
  // Maps iterate in insertion order, so the first key is the oldest.
  while (store.size > MAX_ENTRIES) store.delete(store.keys().next().value as string);
};

export const getWalkInRead = (taUserId: string, sha256: string): ExtractedProfileData | null => {
  const key = keyOf(taUserId, sha256);
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }
  return entry.data;
};

export const clearWalkInReads = (): void => store.clear();
