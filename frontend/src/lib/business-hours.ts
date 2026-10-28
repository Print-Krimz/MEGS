/**
 * Office hours for interviews and contract signing, in Manila time.
 * Minutes from midnight; `end` is inclusive (a 5:00 PM start is allowed).
 * Mirrors backend/src/config/business-hours.ts; a backend test keeps the two in sync.
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

const clock = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  return `${h % 12 || 12}${minutes % 60 ? `:${String(minutes % 60).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
};

/** Short form of the office hours for helper text, built from SCHEDULE_HOURS. */
export const OFFICE_HOURS_SHORT = `Mon–Fri ${clock(SCHEDULE_HOURS.weekday.start)}–${clock(SCHEDULE_HOURS.weekday.end)}, Sat ${clock(SCHEDULE_HOURS.saturday.start)}–${clock(SCHEDULE_HOURS.saturday.end)}`;

/** MEGS main office, used as the default contract-signing location. */
export const COMPANY_ADDRESS = "2nd Flr. PJAR Building #9 P. Gomez St. Oreta Subd. Malinta Valenzuela City";

/** Map position of the main office (matches the Valenzuela pin on the landing page). */
export const COMPANY_LAT_LNG = [14.6991, 120.984] as const;

/** Open hours for a weekday number (0 = Sunday … 6 = Saturday), or null when closed. */
export const hoursForWeekday = (weekday: number): OpenHours | null => {
  if (weekday === 0) return SCHEDULE_HOURS.sunday;
  if (weekday === 6) return SCHEDULE_HOURS.saturday;
  return SCHEDULE_HOURS.weekday;
};
