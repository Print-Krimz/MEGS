const LAST_LOCATION_KEY = "megs_ta_last_interview_location";
const MANAGED_DAILY_PATH_PATTERN = /^\/megs-init-[a-z0-9-]+$/i;

/** True when the stored location is an HTTPS video meeting URL (Daily, Meet, Zoom, Teams). */
export function isOnlineMeetingUrl(value?: string | null): boolean {
  const trimmed = value?.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

/** True when the URL is a per-candidate Daily.co room provisioned automatically by MEGS. */
export function isManagedDailyRoomUrl(value?: string | null): boolean {
  const trimmed = value?.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") return false;
    if (parsed.hostname !== "daily.co" && !parsed.hostname.endsWith(".daily.co")) return false;
    return MANAGED_DAILY_PATH_PATTERN.test(parsed.pathname);
  } catch {
    return false;
  }
}

export function getRememberedInterviewLocation(): string {
  try {
    if (typeof window === "undefined" || !window.localStorage) return "";
    const saved = window.localStorage.getItem(LAST_LOCATION_KEY) ?? "";
    return isManagedDailyRoomUrl(saved) ? "" : saved;
  } catch {
    return "";
  }
}

export function rememberInterviewLocation(location: string): void {
  const trimmed = location.trim();
  if (!trimmed || isManagedDailyRoomUrl(trimmed)) return;
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem(LAST_LOCATION_KEY, trimmed);
  } catch {
    // Ignore storage errors in restricted/private environments.
  }
}

const pad2 = (n: number) => String(n).padStart(2, "0");

const toIcsUtc = (date: Date): string =>
  `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}T${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`;

const escapeIcs = (value: string): string =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");

/** Generates and downloads a standard `.ics` calendar file for an online interview. */
export function downloadInterviewIcs(params: {
  interviewId: number;
  title: string;
  scheduledAt: string;
  location: string;
  durationMinutes?: number;
}): void {
  if (typeof document === "undefined") return;
  const start = new Date(params.scheduledAt);
  if (Number.isNaN(start.getTime())) return;
  const end = new Date(start.getTime() + (params.durationMinutes ?? 30) * 60_000);
  const cleanLocation = params.location.replace(/[\r\n]+/g, " ").trim();
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MEGS Inc.//Recruitment Portal//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:interview-${params.interviewId}@megsinc.com`,
    `DTSTAMP:${toIcsUtc(new Date())}`,
    `DTSTART:${toIcsUtc(start)}`,
    `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${escapeIcs(params.title)}`,
    `DESCRIPTION:${escapeIcs(`Join your MEGS interview: ${cleanLocation}`)}`,
    `LOCATION:${escapeIcs(cleanLocation)}`,
    `URL;VALUE=URI:${cleanLocation}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `megs-interview-${params.interviewId}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
