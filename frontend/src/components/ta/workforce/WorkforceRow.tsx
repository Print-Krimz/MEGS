import React from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "../../../lib/utils";
import { TA_STATUS_TONE_CLASSES, type TAStatusTone } from "../../../lib/ta-copy";
import { initialsOf } from "./initials";

export const Avatar: React.FC<{ name: string; className?: string }> = ({ name, className }) => (
  <span
    aria-hidden="true"
    className={cn(
      "flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-navy-soft text-xs font-semibold tracking-wide text-navy",
      className,
    )}
  >
    {initialsOf(name)}
  </span>
);

/**
 * Left cell of every Workforce row: avatar, name, and one line of context (client and site, job).
 * Each context part stays its own element so it can be read and searched on its own.
 */
export const PersonCell: React.FC<{
  name: string;
  context?: Array<string | null | undefined>;
  /** When set, only the name is the link, so its accessible name stays the person's name. */
  href?: string;
}> = ({ name, context = [], href }) => {
  const parts = context.filter((part): part is string => Boolean(part));
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar name={name} />
      <span className="min-w-0">
        {href ? (
          <Link
            to={href}
            className="focus-ring inline-flex break-words rounded-sm font-medium text-navy underline-offset-2 hover:underline pointer-coarse:min-h-11 pointer-coarse:items-center"
          >
            {name}
          </Link>
        ) : (
          <span className="block break-words font-medium">{name}</span>
        )}
        {href ? <span className="block" /> : null}
        {parts.length > 0 && (
          <span className="block break-words text-xs font-normal text-slate-600">
            {parts.map((part, index) => (
              <React.Fragment key={`${part}-${index}`}>
                {index > 0 && <span aria-hidden="true"> · </span>}
                <span>{part}</span>
              </React.Fragment>
            ))}
          </span>
        )}
      </span>
    </span>
  );
};

/** One status chip with its age or due line underneath. */
export const StatusWithAge: React.FC<{
  chip: React.ReactNode;
  age?: React.ReactNode;
  ageTone?: "normal" | "urgent" | "warning";
}> = ({ chip, age, ageTone = "normal" }) => (
  <div className="space-y-1">
    <div>{chip}</div>
    {age ? (
      <div
        className={cn(
          "text-xs",
          ageTone === "urgent" ? "font-medium text-rose-700" : ageTone === "warning" ? "font-medium text-amber-800" : "text-slate-600",
        )}
      >
        {age}
      </div>
    ) : null}
  </div>
);

/** Plain status chip for states that are not a StatusBadge (queue stages, urgency). */
export const ToneChip: React.FC<{ tone: TAStatusTone; children: React.ReactNode }> = ({ tone, children }) => (
  <span
    className={cn(
      "inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-xs font-medium",
      TA_STATUS_TONE_CLASSES[tone],
    )}
  >
    {children}
  </span>
);

/**
 * Phone version of a Workforce row: same four parts as the table row, with 44px targets.
 * The name opens the record; the action sits on its own line.
 */
export const WorkforceCard: React.FC<{
  href: string;
  name: string;
  context?: Array<string | null | undefined>;
  status: React.ReactNode;
  details?: React.ReactNode;
  action?: React.ReactNode;
}> = ({ href, name, context, status, details, action }) => (
  <article className="space-y-3 p-4">
    <PersonCell name={name} context={context} href={href} />
    <div>{status}</div>
    {details ? <div className="text-sm text-slate-700">{details}</div> : null}
    {action ? <div className="border-t border-slate-200 pt-3">{action}</div> : null}
  </article>
);
