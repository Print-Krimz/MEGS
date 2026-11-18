import React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Banknote, Briefcase, Calendar, Clock, Laptop, MapPin } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Dialog } from "../ui/Dialog";
import { warmTurnstile } from "../common/turnstile-script";
import { useAuth } from "../../hooks/useAuth";
import type { JobPosting } from "../../lib/api/applicant-jobs.api";
import { formatWorkSchedule, workHoursLabel } from "../../lib/mrf-schedule";
import {
  formatDate,
  formatEmploymentType,
  formatSalaryRange,
  formatWorkArrangement,
} from "../../lib/utils";

const warmAuth = {
  onPointerEnter: warmTurnstile,
  onFocus: warmTurnstile,
  onTouchStart: warmTurnstile,
};

const BULLET_LINE_RE = /^([-*•–—]|\d+[.)])\s+/;
const PURE_HEADING_RE = /^#{1,6}\s+|^(\*\*|__)[^*_]+(\*\*|__):?$|:$/;
const SECTION_LABEL_RE =
  /^(about\s+the\s+role|position\s+overview|job\s+overview|overview|requirements|qualifications|what\s+you\s+need):?$/i;

type PlainBlock =
  | { kind: "heading"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "paragraph"; text: string };

/** Displays the client's trade/brand name first, falling back to legal name or "Confidential Employer". */
export function getJobEmployerName(job: JobPosting): string {
  const client = job.mrf?.client;
  if (!client) return "Confidential Employer";
  const tradeName =
    "tradeName" in client && typeof client.tradeName === "string"
      ? client.tradeName.trim()
      : "";
  return tradeName || client.name?.trim() || "Confidential Employer";
}

/** Strips inline markdown formatting (*, **, _, __, `, # headings, links) into clean plain text. */
export function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/(^|\s)_([^_]+)_(\s|$)/g, "$1$2$3")
    .replace(/^#{1,6}\s+/, "")
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/^#+\s*/g, "")
    .trim();
}

/** Extracts clean plain-text preview text for job cards without raw markdown syntax. */
export function stripMarkdownPreview(raw?: string | null): string {
  if (!raw || !raw.trim()) return "";
  const lines = raw
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return "";
  if (lines.length === 1) {
    return stripInlineMarkdown(lines[0].replace(BULLET_LINE_RE, ""));
  }

  const bodyLines = lines
    .filter((line) => !PURE_HEADING_RE.test(line))
    .map((line) => stripInlineMarkdown(line.replace(BULLET_LINE_RE, "")))
    .filter(Boolean);

  const chosen =
    bodyLines.length > 0
      ? bodyLines
      : lines.map((line) => stripInlineMarkdown(line.replace(BULLET_LINE_RE, ""))).filter(Boolean);

  return chosen
    .reduce((acc, part) => {
      if (!acc) return part;
      return /[.!?]$/.test(acc) ? `${acc} ${part}` : `${acc} · ${part}`;
    }, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePlainJobBlocks(raw?: string | null): PlainBlock[] {
  if (!raw || !raw.trim()) return [];
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const blocks: PlainBlock[] = [];
  let pendingList: string[] = [];
  let pendingPara: string[] = [];

  const flushList = () => {
    if (pendingList.length > 0) {
      blocks.push({ kind: "list", items: pendingList });
      pendingList = [];
    }
  };

  const flushPara = () => {
    if (pendingPara.length > 0) {
      blocks.push({ kind: "paragraph", text: pendingPara.join(" ") });
      pendingPara = [];
    }
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      flushList();
      flushPara();
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*•–—]\s+(.+)$/) || trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (bulletMatch) {
      flushPara();
      const cleaned = stripInlineMarkdown(bulletMatch[1]);
      if (cleaned) pendingList.push(cleaned);
      continue;
    }

    const isHeading =
      /^#{1,6}\s+/.test(trimmed) ||
      /^\*\*[^*]+\*\*:?$/.test(trimmed) ||
      /^__[^_]+__:?$/.test(trimmed) ||
      (trimmed.endsWith(":") && trimmed.length <= 50);

    if (isHeading) {
      flushList();
      flushPara();
      const cleaned = stripInlineMarkdown(trimmed).replace(/:$/, "").trim();
      if (cleaned && !SECTION_LABEL_RE.test(cleaned)) {
        blocks.push({ kind: "heading", text: cleaned });
      }
      continue;
    }

    flushList();
    const cleaned = stripInlineMarkdown(trimmed);
    if (cleaned) pendingPara.push(cleaned);
  }

  flushList();
  flushPara();
  return blocks;
}

function formatJobScheduleDisplay(mrf?: JobPosting["mrf"]): string | null {
  if (!mrf) return null;
  const standard = formatWorkSchedule(mrf);
  if (standard) return standard;

  const fallbackParts = [
    mrf.workShift ? mrf.workShift.replace(/_/g, " ") : null,
    mrf.workDays ? mrf.workDays.replace(/_/g, " ") : null,
    mrf.workHoursPerDay ? workHoursLabel(mrf.workHoursPerDay) : null,
  ].filter((part): part is string => Boolean(part));

  const time = mrf.workTime?.trim();
  if (fallbackParts.length === 0) return time || null;
  return time ? `${fallbackParts.join(" · ")} (${time})` : fallbackParts.join(" · ");
}

const PlainJobSection: React.FC<{ title: string; content?: string | null }> = ({ title, content }) => {
  const blocks = parsePlainJobBlocks(content);
  if (blocks.length === 0) return null;

  return (
    <section className="space-y-2.5">
      <h3 className="text-sm font-semibold text-[#0B315D]">{title}</h3>
      <div className="space-y-2.5 text-sm leading-relaxed text-[#102A43]">
        {blocks.map((block, index) => {
          if (block.kind === "heading") {
            return (
              <h4 key={index} className="pt-1 text-sm font-semibold text-[#102A43]">
                {block.text}
              </h4>
            );
          }
          if (block.kind === "list") {
            return (
              <ul key={index} className="space-y-1.5 pl-1">
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="flex items-start gap-2.5">
                    <span
                      aria-hidden="true"
                      className="mt-2 size-1.5 shrink-0 rounded-full bg-[#0B315D]/50"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            );
          }
          return <p key={index}>{block.text}</p>;
        })}
      </div>
    </section>
  );
};

export interface PublicJobDetailDialogProps {
  job: JobPosting | null;
  open: boolean;
  onClose: () => void;
}

export const PublicJobDetailDialog: React.FC<PublicJobDetailDialogProps> = ({
  job,
  open,
  onClose,
}) => {
  const { isAuthenticated } = useAuth();

  if (!job) return null;

  const employerName = getJobEmployerName(job);
  const industry = job.mrf?.client?.industry;
  const worksite = job.location?.trim() || job.mrf?.location?.trim() || "To be confirmed";
  const employmentType = formatEmploymentType(job.mrf?.employmentType);
  const workArrangement = formatWorkArrangement(job.mrf?.workArrangement);
  const hasSalary = Boolean((job.mrf?.salaryRangeMin ?? 0) > 0 || (job.mrf?.salaryRangeMax ?? 0) > 0);
  const salaryRange = hasSalary
    ? formatSalaryRange(job.mrf?.salaryRangeMin, job.mrf?.salaryRangeMax)
    : null;
  const schedule = formatJobScheduleDisplay(job.mrf);
  const hasContent = Boolean(job.description?.trim() || job.requirements?.trim());

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      closeOnBackdrop
      title={job.title}
      description={industry ? `${employerName} · ${industry}` : employerName}
    >
      <div className="space-y-5">
        <dl className="grid grid-cols-1 gap-3.5 rounded-lg border border-slate-200 bg-[#F7F9FC] p-4 text-sm sm:grid-cols-2">
          <div className="flex items-start gap-2.5">
            <MapPin className="mt-0.5 size-4 shrink-0 text-[#0B315D]" aria-hidden="true" />
            <div className="min-w-0">
              <dt className="text-xs font-medium text-slate-600">Worksite</dt>
              <dd className="font-medium text-[#102A43] break-words">{worksite}</dd>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Briefcase className="mt-0.5 size-4 shrink-0 text-[#0B315D]" aria-hidden="true" />
            <div className="min-w-0">
              <dt className="text-xs font-medium text-slate-600">Employment type</dt>
              <dd className="font-medium text-[#102A43]">{employmentType}</dd>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Laptop className="mt-0.5 size-4 shrink-0 text-[#0B315D]" aria-hidden="true" />
            <div className="min-w-0">
              <dt className="text-xs font-medium text-slate-600">Work arrangement</dt>
              <dd className="font-medium text-[#102A43]">{workArrangement}</dd>
            </div>
          </div>

          {salaryRange && (
            <div className="flex items-start gap-2.5">
              <Banknote className="mt-0.5 size-4 shrink-0 text-[#0B315D]" aria-hidden="true" />
              <div className="min-w-0">
                <dt className="text-xs font-medium text-slate-600">Monthly salary</dt>
                <dd className="font-semibold tabular-nums text-[#0B315D]">{salaryRange}</dd>
              </div>
            </div>
          )}

          {schedule && (
            <div className="flex items-start gap-2.5">
              <Clock className="mt-0.5 size-4 shrink-0 text-[#0B315D]" aria-hidden="true" />
              <div className="min-w-0">
                <dt className="text-xs font-medium text-slate-600">Work schedule</dt>
                <dd className="font-medium text-[#102A43] break-words">{schedule}</dd>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2.5">
            <Calendar className="mt-0.5 size-4 shrink-0 text-[#0B315D]" aria-hidden="true" />
            <div className="min-w-0">
              <dt className="text-xs font-medium text-slate-600">Posted</dt>
              <dd className="font-medium text-[#102A43]">{formatDate(job.createdAt)}</dd>
            </div>
          </div>
        </dl>

        {hasContent ? (
          <div className="space-y-5">
            <PlainJobSection title="Position overview" content={job.description} />
            <PlainJobSection title="Requirements" content={job.requirements} />
          </div>
        ) : (
          <p className="text-sm text-slate-600">
            Full role responsibilities and requirements will be discussed during screening.
          </p>
        )}

        <div className="flex flex-col-reverse gap-2.5 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-end">
          {isAuthenticated ? (
            <Button asChild size="lg" className="min-h-11 w-full sm:w-auto">
              <Link
                to="/app/jobs/$jobId"
                params={{ jobId: String(job.id) }}
                search={{ apply: "1" }}
              >
                Apply now
                <ArrowRight data-icon="inline-end" aria-hidden="true" />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="outline" size="lg" className="min-h-11 w-full sm:w-auto">
                <Link to="/register" {...warmAuth}>
                  Create free account
                </Link>
              </Button>
              <Button asChild size="lg" className="min-h-11 w-full sm:w-auto">
                <Link
                  to="/login"
                  search={{ redirect: `/app/jobs/${job.id}?apply=1` }}
                  {...warmAuth}
                >
                  Apply for this job
                  <ArrowRight data-icon="inline-end" aria-hidden="true" />
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
};
