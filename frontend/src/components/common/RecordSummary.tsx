import React from "react";
import { Link } from "@tanstack/react-router";
import { Check, Copy } from "lucide-react";
import { cn } from "../../lib/utils";
import { notify } from "../../lib/feedback";

export interface RecordSummaryFact {
  label: string;
  value: React.ReactNode;
  /** When set, a copy button puts this text on the clipboard. */
  copyValue?: string;
  /** Internal paths use the router; mailto:, tel: and http(s) use a plain anchor. */
  href?: string;
}

export interface RecordSummaryProgress {
  value: number;
  max: number;
  label: string;
}

export interface RecordSummaryProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Initials shown in the square avatar. Omit to hide the avatar. */
  avatarText?: string;
  chips?: React.ReactNode;
  facts: RecordSummaryFact[];
  progress?: RecordSummaryProgress;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  /** Use "h1" when the summary is the page's main heading (detail pages). */
  titleAs?: "h1" | "h2";
}

const CopyButton: React.FC<{ label: string; text: string }> = ({ label, text }) => {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      notify.success(`${label} copied`);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      notify.error(`Could not copy ${label.toLowerCase()}`);
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${label.toLowerCase()}`}
      className="focus-ring inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 sm:h-6 sm:w-6"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      )}
    </button>
  );
};

const FactValue: React.FC<{ fact: RecordSummaryFact }> = ({ fact }) => {
  const linkClass = "inline-flex min-w-0 max-w-full items-center rounded-sm font-medium text-navy underline-offset-2 hover:underline focus-ring pointer-coarse:min-h-11";
  let content = fact.value;
  if (fact.href) {
    content = /^(\/|#)/.test(fact.href) ? (
      <Link to={fact.href} className={linkClass}>
        {fact.value}
      </Link>
    ) : (
      <a href={fact.href} className={linkClass}>
        {fact.value}
      </a>
    );
  }
  return (
    <span className="flex min-w-0 items-center gap-1">
      <span className="min-w-0 wrap-anywhere">{content}</span>
      {fact.copyValue ? <CopyButton label={fact.label} text={fact.copyValue} /> : null}
    </span>
  );
};

/**
 * Header strip for a single record: what it is, its state, the four to six facts people
 * look up most, and the actions that apply. One row on desktop, two-column facts on phones.
 */
export const RecordSummary: React.FC<RecordSummaryProps> = ({
  title,
  subtitle,
  avatarText,
  chips,
  facts,
  progress,
  actions,
  children,
  className,
  titleAs: TitleTag = "h2",
}) => {
  const pct = progress && progress.max > 0 ? Math.min(100, Math.max(0, (progress.value / progress.max) * 100)) : 0;

  return (
    <section className={cn("rounded-md border border-slate-300 bg-white", className)}>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-center gap-3.5">
          {avatarText ? (
            <div
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-navy text-base font-semibold tracking-wide text-white"
            >
              {avatarText}
            </div>
          ) : null}
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <TitleTag className="font-display text-xl leading-tight text-slate-950 break-words md:text-2xl">{title}</TitleTag>
              {chips}
            </div>
            {subtitle ? <p className="text-sm text-slate-600">{subtitle}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">{actions}</div> : null}
      </div>

      {facts.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-slate-200 px-4 py-4 sm:px-5 md:grid-cols-3 xl:grid-cols-6">
          {facts.map((fact) => (
            <div key={fact.label} className="min-w-0 space-y-0.5">
              <dt className="text-xs font-medium text-slate-600">{fact.label}</dt>
              <dd className="text-sm text-slate-900">
                <FactValue fact={fact} />
              </dd>
            </div>
          ))}
        </dl>
      )}

      {progress && (
        <div className="border-t border-slate-200 px-4 py-3 sm:px-5">
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
            <span className="font-medium text-slate-600">{progress.label}</span>
            <span className="tabular-nums text-slate-900">
              {progress.value} of {progress.max}
            </span>
          </div>
          <div
            role="progressbar"
            aria-label={progress.label}
            aria-valuemin={0}
            aria-valuemax={progress.max}
            aria-valuenow={progress.value}
            className="h-1.5 overflow-hidden rounded-full bg-slate-200"
          >
            <div className="h-full bg-navy" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {children ? <div className="border-t border-slate-200 px-4 py-3 sm:px-5">{children}</div> : null}
    </section>
  );
};
