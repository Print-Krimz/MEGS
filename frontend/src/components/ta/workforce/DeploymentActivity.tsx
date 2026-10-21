import React, { useMemo, useState } from "react";
import { ArrowRightLeft, ClipboardCheck, FileText, type LucideIcon } from "lucide-react";
import type { Deployment } from "../../../lib/types/employee.types";
import { formatDate, formatDateTime } from "../../../lib/utils";
import { deploymentHistoryLabel, deploymentStatusLabel } from "../../../lib/labels";
import { cn } from "../../../lib/utils";

interface ActivityItem {
  id: string;
  icon: LucideIcon;
  title: React.ReactNode;
  meta?: { label: string; value: React.ReactNode }[];
  body?: React.ReactNode;
}

/** Dated rail. The icon and title already name the event, so there is no separate type chip. */
const ActivityList: React.FC<{ items: ActivityItem[]; ariaLabel: string }> = ({ items, ariaLabel }) => (
  <ol aria-label={ariaLabel} className="relative">
    {items.map((item, index) => {
      const Node = item.icon;
      return (
        <li key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
          {index < items.length - 1 && (
            <span aria-hidden="true" className="absolute bottom-0 left-[13px] top-7 w-px bg-slate-300" />
          )}
          <span
            aria-hidden="true"
            className="relative z-[1] mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700"
          >
            <Node className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white p-3">
            <div className="text-sm font-semibold text-slate-950">{item.title}</div>
            {item.meta && item.meta.length > 0 && (
              <dl className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                {item.meta.map((m) => (
                  <div key={m.label} className="flex min-w-0 gap-1.5">
                    <dt className="text-slate-600">{m.label}</dt>
                    <dd className="min-w-0 break-words text-slate-900">{m.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {item.body ? <div className="mt-2 text-sm text-slate-800">{item.body}</div> : null}
          </div>
        </li>
      );
    })}
  </ol>
);

type ActivityKind = "checkin" | "status" | "agreement";
type Filter = "all" | ActivityKind;

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All activity" },
  { id: "checkin", label: "Check-ins" },
  { id: "status", label: "Status changes" },
  { id: "agreement", label: "Agreements" },
];

const agreementDates = (start?: string | null, end?: string | null) =>
  `${start ? formatDate(start) : "Not set"} to ${end ? formatDate(end) : "open"}`;

/** Check-ins, status changes and agreement versions as one dated list, newest first. */
export const DeploymentActivity: React.FC<{ deployment: Deployment }> = ({ deployment }) => {
  const [filter, setFilter] = useState<Filter>("all");

  const entries = useMemo(() => {
    const list: Array<{ kind: ActivityKind; at: string; item: ActivityItem }> = [];
    for (const review of deployment.reviews ?? []) {
      list.push({
        kind: "checkin",
        at: review.reviewedAt,
        item: {
          id: `checkin-${review.id}`,
          icon: ClipboardCheck,
          title: "Check-in recorded",
          meta: [
            { label: "Date", value: formatDateTime(review.reviewedAt) },
            ...(review.reviewedBy?.email ? [{ label: "By", value: review.reviewedBy.email }] : []),
            { label: "Next check-in", value: review.nextReviewAt ? formatDate(review.nextReviewAt) : "Not scheduled" },
          ],
          body: review.notes || undefined,
        },
      });
    }
    for (const change of deployment.statusHistory ?? []) {
      list.push({
        kind: "status",
        at: change.createdAt,
        item: {
          id: `status-${change.id}`,
          icon: ArrowRightLeft,
          title: `${deploymentHistoryLabel(change.fromStatus)} → ${deploymentStatusLabel(change.toStatus)}`,
          meta: [{ label: "Date", value: formatDateTime(change.createdAt) }],
          body: change.reason ? `“${change.reason}”` : undefined,
        },
      });
    }
    for (const version of deployment.agreementVersions ?? []) {
      list.push({
        kind: "agreement",
        at: version.recordedAt,
        item: {
          id: `agreement-${version.id}`,
          icon: FileText,
          title: "Agreement version recorded",
          meta: [
            { label: "Date", value: formatDateTime(version.recordedAt) },
            { label: "Dates", value: agreementDates(version.contractStart, version.contractEnd) },
          ],
          body: version.contractTerms ? <span className="whitespace-pre-wrap">{version.contractTerms}</span> : undefined,
        },
      });
    }
    return list.sort((a, b) => b.at.localeCompare(a.at));
  }, [deployment.reviews, deployment.statusHistory, deployment.agreementVersions]);

  const visible = entries.filter((entry) => filter === "all" || entry.kind === filter);

  return (
    <section className="space-y-3 rounded-md border border-slate-300 bg-white p-4 md:p-5" aria-labelledby="dep-activity-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="dep-activity-heading" className="text-lg font-semibold text-slate-950">Activity</h2>
        <div role="group" aria-label="Filter activity" className="flex flex-wrap gap-1.5">
          {FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={filter === option.id}
              onClick={() => setFilter(option.id)}
              className={cn(
                "focus-ring min-h-11 rounded-md border px-3 text-sm font-medium md:min-h-9",
                filter === option.id
                  ? "border-navy bg-navy text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      {visible.length === 0 ? (
        <p className="py-2 text-sm text-slate-600">
          {entries.length === 0
            ? `No check-ins or status changes recorded yet. Current status: ${deploymentStatusLabel(deployment.status)}.`
            : "Nothing of this type yet."}
        </p>
      ) : (
        <ActivityList ariaLabel="Deployment activity" items={visible.map((entry) => entry.item)} />
      )}
    </section>
  );
};

/** Older agreement versions: closed by default, one dated row each with its document link. */
export const AgreementVersionsDisclosure: React.FC<{ versions: NonNullable<Deployment["agreementVersions"]> }> = ({ versions }) => {
  if (versions.length === 0) return null;
  return (
    <details className="group rounded-md border border-slate-300 bg-white">
      <summary className="focus-ring flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-md px-4 py-2 text-sm font-semibold text-slate-950 md:px-5">
        <span>Previous agreement versions ({versions.length})</span>
        <span className="text-xs font-medium text-slate-600 group-open:hidden">Show</span>
        <span className="hidden text-xs font-medium text-slate-600 group-open:inline">Hide</span>
      </summary>
      <div className="overflow-x-auto border-t border-slate-200">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Previous agreement versions</caption>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-600">
              <th scope="col" className="px-4 py-2 md:px-5">Recorded</th>
              <th scope="col" className="px-3 py-2">Agreement dates</th>
              <th scope="col" className="px-3 py-2">Status</th>
              <th scope="col" className="px-4 py-2 md:px-5">Document</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {versions.map((version) => (
              <tr key={version.id} className="align-top">
                <td className="whitespace-nowrap px-4 py-2.5 text-slate-900 md:px-5">{formatDate(version.recordedAt)}</td>
                <td className="px-3 py-2.5 text-slate-800">
                  {agreementDates(version.contractStart, version.contractEnd)}
                  {version.contractTerms && <p className="mt-0.5 max-w-md whitespace-pre-wrap text-xs text-slate-600">{version.contractTerms}</p>}
                </td>
                <td className="px-3 py-2.5 text-slate-700">{version.contractStatus ? deploymentStatusLabel(version.contractStatus) : "Not recorded"}</td>
                <td className="px-4 py-2.5 md:px-5">
                  {version.contractDocumentUrl ? (
                    <a
                      href={version.contractDocumentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="focus-ring inline-flex min-h-11 items-center rounded-sm font-medium text-navy underline-offset-2 hover:underline md:min-h-0"
                    >
                      Open document
                    </a>
                  ) : (
                    <span className="text-slate-600">None</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
};
