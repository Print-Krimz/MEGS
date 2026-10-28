/**
 * Office hours for interviews and contract signing, in Manila time.
 * Minutes from midnight; `end` is inclusive (a 5:00 PM start is allowed).
 * Mirrored in frontend/src/lib/business-hours.ts; a test keeps the two in sync.
 */
export interface OpenHours {
  start: number;
  end: number;
}

export const SCHEDULE_HOURS: {
  weekday: OpenHours;
  saturday: OpenHours;
  sunday: OpenHours | null;
} = {
  weekday: { start: 9 * 60, end: 17 * 60 },
  saturday: { start: 9 * 60, end: 12 * 60 },
  sunday: null,
};

export const OFFICE_HOURS_MESSAGE =
  "Pick a time during office hours: Monday to Friday 9:00 AM–5:00 PM, Saturday 9:00 AM–12:00 PM. Closed on Sundays.";

/** MEGS main office, used on the contract and as the default contract-signing location. */
export const COMPANY_ADDRESS = "2nd Flr. PJAR Building #9 P. Gomez St. Oreta Subd. Malinta Valenzuela City";

/** Open hours for a weekday number (0 = Sunday … 6 = Saturday), or null when closed. */
export const hoursForWeekday = (weekday: number): OpenHours | null => {
  if (weekday === 0) return SCHEDULE_HOURS.sunday;
  if (weekday === 6) return SCHEDULE_HOURS.saturday;
  return SCHEDULE_HOURS.weekday;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** True when the instant falls inside office hours on its Manila calendar day. */
export const isWithinBusinessHours = (dateOrIso: string | Date): boolean => {
  const date = typeof dateOrIso === "string" ? new Date(dateOrIso) : dateOrIso;
  if (!Number.isFinite(date.getTime())) return false;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const weekday = WEEKDAYS.indexOf(parts.find((p) => p.type === "weekday")?.value ?? "");
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const hours = hoursForWeekday(weekday);
  if (!hours) return false;
  const minutesFromMidnight = hour * 60 + minute;
  return minutesFromMidnight >= hours.start && minutesFromMidnight <= hours.end;
};
