import React from "react";
import { Check } from "lucide-react";
import { cn, formatDate } from "../../../lib/utils";

export interface MRFCreateSummaryValues {
  clientName?: string;
  title: string;
  headcount: number | string;
  priority: string;
  targetFillDate: string;
  location: string;
  employmentType: string;
  workArrangement: string;
  salaryMin: string;
  salaryMax: string;
  skillCount: number;
}

const PRIORITY_LABELS: Record<string, string> = { LOW: "Low", NORMAL: "Normal", HIGH: "High", URGENT: "Urgent" };

const money = (value: string) => (value ? `PHP ${Number(value).toLocaleString("en-US")}` : "");

const salaryText = (min: string, max: string) => {
  if (min && max) return `${money(min)} to ${money(max)}`;
  if (min) return `From ${money(min)}`;
  if (max) return `Up to ${money(max)}`;
  return "";
};

/** Plain list of what the request says so far. Empty answers read "Not set" so gaps are visible before saving. */
export const MRFCreateSummary: React.FC<{ values: MRFCreateSummaryValues; className?: string }> = ({ values, className }) => {
  const rows: Array<[string, string]> = [
    ["Client", values.clientName ?? ""],
    ["Request title", values.title.trim()],
    ["Workers needed", String(values.headcount || "")],
    ["Priority", PRIORITY_LABELS[values.priority] ?? values.priority],
    ["Needed by", values.targetFillDate ? formatDate(values.targetFillDate) : ""],
    ["Work site", values.location.trim()],
    ["Employment", [values.employmentType, values.workArrangement].filter(Boolean).join(" · ")],
    ["Monthly pay", salaryText(values.salaryMin, values.salaryMax)],
    ["Skills listed", values.skillCount > 0 ? String(values.skillCount) : ""],
  ];
  return (
    <dl className={cn("space-y-3 text-sm", className)}>
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs font-medium text-slate-600">{label}</dt>
          <dd className={cn("break-words", value ? "text-slate-900" : "text-slate-500")}>{value || "Not set"}</dd>
        </div>
      ))}
    </dl>
  );
};

export interface MRFStep {
  id: string;
  label: string;
  done: boolean;
  optional?: boolean;
}

/** Jump links for the form sections. Anchors keep it keyboard and screen-reader friendly with no extra state. */
export const MRFStepList: React.FC<{ steps: MRFStep[]; className?: string }> = ({ steps, className }) => (
  <nav aria-label="Request steps" className={className}>
    <ol className="space-y-1">
      {steps.map((step, index) => (
        <li key={step.id}>
          <a
            href={`#${step.id}`}
            className="flex min-h-11 items-center gap-3 rounded-md px-2 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 focus-ring"
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                step.done ? "border-navy bg-navy text-white" : "border-slate-300 bg-white text-slate-600",
              )}
            >
              {step.done ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <span>{step.label}</span>
            {step.done && <span className="sr-only">(complete)</span>}
            {step.optional && !step.done && <span className="text-xs font-normal text-slate-600">Optional</span>}
          </a>
        </li>
      ))}
    </ol>
  </nav>
);
