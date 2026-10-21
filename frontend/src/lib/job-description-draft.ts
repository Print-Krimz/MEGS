import { plural } from "./plural";
import { humanizeEnum } from "./labels";

export interface JobDescriptionDraftSource {
  location?: string | null;
  headcount?: number | null;
  employmentType?: string | null;
  workArrangement?: string | null;
}

/** Requests store readable words ("Contractual", "On-site"); older ones hold codes like ON_SITE. */
const readable = (value: string): string => {
  const text = value.trim();
  return /^[A-Z0-9_]+$/.test(text) ? humanizeEnum(text).replace(/^On site$/, "On-site") : text;
};

/**
 * A short opening paragraph for a job posting, built only from a manpower request's role details.
 * It never reads the request's client notes, which are written for MEGS staff and must not reach the
 * public posting. Missing details are left out, never guessed. Returns "" when nothing is known.
 */
export const buildJobDescriptionDraft = (request: JobDescriptionDraftSource): string => {
  const where = request.location?.trim();
  const count = Number(request.headcount);
  const hiring = Number.isFinite(count) && count > 0 ? `We are hiring ${plural(count, "person", "people")}` : "";

  const lines: string[] = [];
  if (hiring) lines.push(`${hiring}${where ? ` at ${where}` : ""}.`);
  else if (where) lines.push(`This opening is based at ${where}.`);

  const details: string[] = [];
  if (request.employmentType?.trim()) details.push(`Employment type: ${readable(request.employmentType)}`);
  if (request.workArrangement?.trim()) details.push(`Work arrangement: ${readable(request.workArrangement)}`);

  return [lines.join(" "), details.join("\n")].filter(Boolean).join("\n\n");
};
