import { isOnlineMeetingUrl } from "../services/scheduling/daily-meeting.service.js";
import type { MailAttachment } from "./mailer.js";
import { isSyntheticEmail } from "./sms.js";

export interface BuildInterviewIcsParams {
  interviewId: number;
  title: string;
  scheduledAt: Date;
  durationMinutes?: number;
  location: string;
  description?: string;
  organizerEmail?: string;
  attendeeEmail?: string;
  createdAt?: Date | null;
  sequence?: number;
}

const DEFAULT_ORGANIZER_EMAIL = "noreply@megsinc.com";
const DEFAULT_DURATION_MINUTES = 30;

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** Formats a Date as RFC 5545 UTC timestamp `YYYYMMDDTHHMMSSZ`. */
export const formatIcsUtcTimestamp = (date: Date): string =>
  `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}T${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`;

const stripControlChars = (value: string): string => value.replace(/[\r\n\x00-\x1F\x7F]+/g, " ").trim();

/** Escapes RFC 5545 TEXT values (`\`, `;`, `,`, and newlines). */
const escapeIcsText = (value: string): string =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");

/** Folds a single iCalendar content line at 75 octets per RFC 5545 Section 3.1. */
const foldIcsLine = (line: string): string => {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;

  const parts: string[] = [];
  let current = "";
  let currentBytes = 0;
  let limit = 75;

  for (const ch of line) {
    const chBytes = Buffer.byteLength(ch, "utf8");
    if (currentBytes + chBytes > limit && current.length > 0) {
      parts.push(current);
      current = ` ${ch}`;
      currentBytes = 1 + chBytes;
      limit = 75;
    } else {
      current += ch;
      currentBytes += chBytes;
    }
  }
  if (current) parts.push(current);
  return parts.join("\r\n");
};

const extractEmailAddress = (raw?: string): string => {
  const cleaned = stripControlChars(raw || "");
  const angleMatch = cleaned.match(/<([^>]+)>/);
  const candidate = (angleMatch ? angleMatch[1] : cleaned).trim();
  return /^[^\s@]+@[^\s@]+$/.test(candidate) ? candidate : DEFAULT_ORGANIZER_EMAIL;
};

/** Builds an RFC 5545 `METHOD:REQUEST` calendar invite attachment for an online interview. */
export const buildInterviewIcs = (params: BuildInterviewIcsParams): string => {
  const now = new Date();
  const start = new Date(params.scheduledAt);
  const durationMinutes = params.durationMinutes ?? DEFAULT_DURATION_MINUTES;
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const organizer = extractEmailAddress(params.organizerEmail || process.env.EMAIL_FROM);
  const sequence =
    typeof params.sequence === "number"
      ? Math.max(0, Math.floor(params.sequence))
      : params.createdAt
      ? Math.max(1, Math.floor((now.getTime() - params.createdAt.getTime()) / 1000))
      : 0;

  const cleanLocation = stripControlChars(params.location);
  const description = params.description?.trim() || `Join your MEGS interview: ${cleanLocation}`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MEGS Inc.//Recruitment Portal//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:interview-${params.interviewId}@megsinc.com`,
    `SEQUENCE:${sequence}`,
    `DTSTAMP:${formatIcsUtcTimestamp(now)}`,
    `DTSTART:${formatIcsUtcTimestamp(start)}`,
    `DTEND:${formatIcsUtcTimestamp(end)}`,
    `SUMMARY:${escapeIcsText(params.title)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `LOCATION:${escapeIcsText(cleanLocation)}`,
    `URL;VALUE=URI:${cleanLocation}`,
    `ORGANIZER;CN=MEGS Inc.:mailto:${organizer}`,
  ];

  const attendee = params.attendeeEmail ? extractEmailAddress(params.attendeeEmail) : "";
  if (params.attendeeEmail && attendee && !isSyntheticEmail(attendee) && attendee !== DEFAULT_ORGANIZER_EMAIL) {
    lines.push(`ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${attendee}`);
  }

  lines.push("STATUS:CONFIRMED", "END:VEVENT", "END:VCALENDAR", "");
  return lines.map(foldIcsLine).join("\r\n");
};

export interface InitialInterviewAttachmentParams {
  interviewId: number;
  jobTitle?: string | null;
  scheduledAt: Date;
  location?: string | null;
  isReschedule?: boolean;
  createdAt?: Date | null;
}

/**
 * Returns a recipient-scoped `invite.ics` attachment factory for online Initial Screening interviews,
 * or `undefined` when the interview does not have an HTTPS meeting link.
 */
export const buildInitialInterviewAttachments = (
  params: InitialInterviewAttachmentParams
): ((recipientEmail: string) => MailAttachment[]) | undefined => {
  const location = params.location?.trim();
  if (!location || !isOnlineMeetingUrl(location)) return undefined;

  const title = `MEGS Initial Interview — ${params.jobTitle?.trim() || "Job"}`;
  const description = `Join your MEGS Initial Screening interview: ${location}`;

  return (recipientEmail: string): MailAttachment[] => [
    {
      filename: "invite.ics",
      contentType: "text/calendar; charset=utf-8; method=REQUEST",
      content: buildInterviewIcs({
        interviewId: params.interviewId,
        title,
        scheduledAt: params.scheduledAt,
        location,
        description,
        attendeeEmail: recipientEmail,
        ...(params.isReschedule ? { createdAt: params.createdAt } : { sequence: 0 }),
      }),
    },
  ];
};
