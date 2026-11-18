import crypto from "node:crypto";
import { safeLogError } from "../../security/errors.js";

const DAILY_API_BASE_URL = "https://api.daily.co/v1";
const DAILY_REQUEST_TIMEOUT_MS = 10_000;
const ROOM_EXPIRY_AFTER_INTERVIEW_SECONDS = 2 * 60 * 60;
const MANAGED_ROOM_NAME_PATTERN = /^\/?(megs-init-[a-z0-9-]+)$/i;

export interface ProvisionInitialScreeningRoomParams {
  applicationId: number;
  scheduledAt: Date;
  existingLocation?: string | null;
}

const getDailyApiKey = (): string | undefined => process.env.DAILY_API_KEY?.trim() || undefined;

/** True when Daily.co automatic room creation is configured on this server. */
export const isDailyConfigured = (): boolean => Boolean(getDailyApiKey());

/** True when a stored interview location is an HTTPS meeting URL (e.g., Daily, Google Meet, Zoom, Teams). */
export const isOnlineMeetingUrl = (location?: string | null): boolean => {
  const raw = location?.trim();
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" && Boolean(parsed.hostname);
  } catch {
    return false;
  }
};

/** Returns the Daily room slug only for rooms provisioned by MEGS (`https://*.daily.co/megs-init-*`). */
export const extractManagedDailyRoomName = (location?: string | null): string | null => {
  const raw = location?.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:") return null;
    if (parsed.hostname !== "daily.co" && !parsed.hostname.endsWith(".daily.co")) return null;
    const match = parsed.pathname.match(MANAGED_ROOM_NAME_PATTERN);
    return match ? match[1] : null;
  } catch {
    return null;
  }
};

/** Formats the location/format segment for workflow SMS without embedding HTTPS URLs that Philippine carriers drop. */
export const smsLocationClause = (location?: string | null): string => {
  if (isOnlineMeetingUrl(location) && process.env.SMS_INCLUDE_LINKS !== "true") {
    return " Format: Online video interview (link in email and MEGS portal).";
  }
  const place = location?.trim();
  return place ? ` Location: ${place}.` : "";
};

const roomExpiryUnixSeconds = (scheduledAt: Date): number =>
  Math.max(Math.floor(scheduledAt.getTime() / 1000), Math.floor(Date.now() / 1000)) + ROOM_EXPIRY_AFTER_INTERVIEW_SECONDS;

const dailyFetch = async (
  apiKey: string,
  path: string,
  method: "POST" | "DELETE",
  body?: Record<string, unknown>
): Promise<Response> =>
  fetch(`${DAILY_API_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(DAILY_REQUEST_TIMEOUT_MS),
  });

/**
 * Provisions a private-by-slug Daily.co video room for an Initial Screening interview, or extends the
 * expiration of an existing MEGS-managed Daily room when rescheduling.
 */
export const provisionInitialScreeningRoom = async ({
  applicationId,
  scheduledAt,
  existingLocation,
}: ProvisionInitialScreeningRoomParams): Promise<string> => {
  const apiKey = getDailyApiKey();
  if (!apiKey) {
    throw new Error("Automatic video rooms aren't configured right now. Paste a Google Meet or Zoom link instead.");
  }

  const exp = roomExpiryUnixSeconds(scheduledAt);
  const existingRoomName = extractManagedDailyRoomName(existingLocation);

  if (existingRoomName) {
    try {
      const updateRes = await dailyFetch(apiKey, `/rooms/${encodeURIComponent(existingRoomName)}`, "POST", {
        properties: { exp },
      });
      if (updateRes.ok) {
        const updated = (await updateRes.json().catch(() => ({}))) as { url?: string };
        return updated.url?.trim() || existingLocation!.trim();
      }
      if (updateRes.status !== 404) {
        const errBody = await updateRes.text().catch(() => "");
        safeLogError("Daily room update failed", new Error(`HTTP ${updateRes.status}: ${errBody.slice(0, 200)}`));
        throw new Error("Unable to update the online meeting room right now. Please try again or paste a custom link.");
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Unable to update the online meeting room")) {
        throw error;
      }
      safeLogError("Daily room update request failed", error);
      throw new Error("Unable to update the online meeting room right now. Please try again or paste a custom link.");
    }
  }

  const slug = `megs-init-${applicationId}-${crypto.randomBytes(6).toString("hex")}`;
  let createRes: Response;
  try {
    createRes = await dailyFetch(apiKey, "/rooms", "POST", {
      name: slug,
      privacy: "public",
      properties: {
        exp,
        enable_prejoin_ui: true,
        enable_chat: true,
      },
    });
  } catch (error) {
    safeLogError("Daily room creation request failed", error);
    throw new Error("Unable to create an online meeting room right now. Please try again or paste a custom link.");
  }

  if (!createRes.ok) {
    const errBody = await createRes.text().catch(() => "");
    safeLogError("Daily room creation failed", new Error(`HTTP ${createRes.status}: ${errBody.slice(0, 200)}`));
    throw new Error("Unable to create an online meeting room right now. Please try again or paste a custom link.");
  }

  const created = (await createRes.json().catch(() => ({}))) as { url?: string };
  if (!created.url || !isOnlineMeetingUrl(created.url)) {
    throw new Error("Online meeting provider returned an invalid meeting link.");
  }
  return created.url;
};

/** Best-effort cleanup of a MEGS-managed Daily.co room when an online interview is replaced or marked no-show. */
export const deleteDailyInterviewRoomBestEffort = async (location?: string | null): Promise<void> => {
  const apiKey = getDailyApiKey();
  const roomName = extractManagedDailyRoomName(location);
  if (!apiKey || !roomName) return;

  try {
    const res = await dailyFetch(apiKey, `/rooms/${encodeURIComponent(roomName)}`, "DELETE");
    if (!res.ok && res.status !== 404) {
      safeLogError("Daily room cleanup failed", new Error(`HTTP ${res.status} deleting ${roomName}`));
    }
  } catch (error) {
    safeLogError(`Daily room cleanup for ${roomName}`, error);
  }
};
