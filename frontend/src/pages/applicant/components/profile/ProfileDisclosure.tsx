import React from "react";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Circle } from "lucide-react";
import type { SectionStatus } from "./profile-progress";

export interface ProfileDisclosureProps {
  id: string;
  title: string;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  /** Completion state shown next to the title. */
  status?: SectionStatus;
  /** Fields still empty in this section. */
  missing?: number;
  /** "Step 2 of 7" label. */
  step?: string;
  onPrevious?: () => void;
  onNext?: () => void;
  children: React.ReactNode;
}

export const ProfileDisclosure: React.FC<ProfileDisclosureProps> = ({
  id,
  title,
  summary,
  open,
  onToggle,
  status,
  missing = 0,
  step,
  onPrevious,
  onNext,
  children,
}) => (
  <section className="border-b border-slate-200 last:border-b-0">
    <h3 className="m-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
        className="flex min-h-14 w-full items-center justify-between gap-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900">{title}</span>
          {summary && <span className="mt-0.5 block text-xs text-slate-500">{summary}</span>}
        </span>
        {status && (
          <span className="flex w-28 shrink-0 justify-end">
            <StatusPill status={status} missing={missing} hideOptional={id.startsWith("profile-personal-")} />
          </span>
        )}
        <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
    </h3>
    {open && (
      <div id={id} className="pb-5">
        {children}
        {(onPrevious || onNext) && (
          <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={onPrevious}
              disabled={!onPrevious}
              className="inline-flex min-h-11 items-center gap-1 rounded-md border border-navy-line bg-white px-3 text-sm font-medium text-navy hover:bg-navy-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:invisible"
            >
              <ChevronLeft className="size-4" aria-hidden="true" /> Previous
            </button>
            {step && <span className="text-xs text-slate-600">{step}</span>}
            <button
              type="button"
              onClick={onNext}
              disabled={!onNext}
              className="inline-flex min-h-11 items-center gap-1 rounded-md border border-navy bg-navy px-3 text-sm font-medium text-white hover:bg-navy-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:invisible"
            >
              Next <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    )}
  </section>
);

// "Optional" is left off the Personal info sections only; elsewhere it tells optional sections apart from required ones.
const StatusPill: React.FC<{ status: SectionStatus; missing: number; hideOptional?: boolean }> = ({ status, missing, hideOptional }) => {
  if (status === "complete")
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-800">
        <CheckCircle2 className="size-4" aria-hidden="true" /> Complete
      </span>
    );
  if (status === "error")
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-megs-red">
        <AlertCircle className="size-4" aria-hidden="true" /> Fix errors
      </span>
    );
  if (status === "incomplete")
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-amber-800">
        <Circle className="size-4" aria-hidden="true" /> {missing} to fill in
      </span>
    );
  return hideOptional ? null : <span className="shrink-0 text-xs text-slate-500">Optional</span>;
};
