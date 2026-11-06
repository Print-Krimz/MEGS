import React from "react";
import { AlertTriangle } from "lucide-react";
import type { ClientReview } from "../../lib/types/analytics.types";
import { BAR_ON_TRACK, TEXT_AMBER, TEXT_LOSS, WORKLOAD } from "../../lib/chart-palette";
import { formatSampled } from "../../lib/analytics-format";
import { AnalyticsPanel } from "./AnalyticsPanel";
import { DataTableToggle, StackedBar } from "./chart-primitives";

interface ClientReviewPanelProps {
  data: ClientReview;
  className?: string;
  /** Filters the report to this client when a row is chosen. */
  onSelectClient?: (clientId: number) => void;
}

const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

/** Clients ranked by how far their average review wait runs past their own limit. The bar is the average against the limit. */
export const ClientReviewPanel: React.FC<ClientReviewPanelProps> = ({ data, className, onSelectClient }) => {
  const { clients } = data;
  const scale = Math.max(1, ...clients.map((c) => Math.max(c.avgDays ?? 0, c.limitDays)));
  const overLimitCount = clients.filter((c) => c.avgDays !== null && c.avgDays > c.limitDays).length;

  return (
    <AnalyticsPanel
      tone="reports"
      id="client-review"
      title="Slowest client reviews"
      subtitle="Average days in client review vs each client's limit"
      aside={
        clients.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 tabular-nums font-medium text-slate-700">
            <span className="rounded-sm border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-800 shadow-[0_1px_1px_0_rgb(15_23_42/0.03)]">
              <strong className="text-slate-950">{data.sample}</strong> in review
            </span>
            {overLimitCount > 0 && (
              <span className={`rounded-sm border border-[#F5C2C7] bg-[#FDF1F2] px-2 py-0.5 text-xs font-semibold ${TEXT_LOSS}`}>
                {overLimitCount} past limit
              </span>
            )}
          </div>
        ) : undefined
      }
      className={`flex flex-col ${className ?? ""}`}
    >
      {clients.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-xs text-slate-600 font-sans">
          No candidates in client review.
        </div>
      ) : (
        <div className="@container flex flex-1 flex-col p-4">
          <ol className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
            {clients.map((c, i) => {
              const over = c.avgDays !== null && c.avgDays > c.limitDays;
              return (
                <li
                  key={c.clientId}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-3 py-2.5 transition-colors hover:bg-slate-50/70 @xl:grid-cols-[11rem_minmax(0,1fr)_15rem] @xl:gap-y-0"
                >
                  <div className="col-start-1 row-start-1 min-w-0 font-semibold text-slate-900">
                    {onSelectClient ? (
                      <button
                        type="button"
                        onClick={() => onSelectClient(c.clientId)}
                        className="block max-w-full truncate text-left text-xs font-semibold text-navy underline underline-offset-2 decoration-slate-300 hover:decoration-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        {c.clientName}
                      </button>
                    ) : (
                      <span className="block truncate text-xs">{c.clientName}</span>
                    )}
                    <p className="mt-0.5 truncate text-[11px] font-normal font-sans tabular-nums text-slate-600">
                      {c.inReview} in review · limit {days(c.limitDays)}
                    </p>
                  </div>
                  {c.avgDays !== null ? (
                    <StackedBar
                      className="col-span-2 row-start-2 @xl:col-span-1 @xl:col-start-2 @xl:row-start-1"
                      label={`${c.clientName}, average ${days(c.avgDays)}, limit ${days(c.limitDays)}`}
                      heightClass="h-3"
                      max={scale}
                      index={i}
                      segments={[
                        { key: "within", label: "within the limit", value: Math.min(c.avgDays, c.limitDays), color: BAR_ON_TRACK },
                        { key: "over", label: "past the limit", value: Math.max(0, c.avgDays - c.limitDays), color: WORKLOAD.overdue },
                      ]}
                    />
                  ) : (
                    <div aria-hidden="true" className="col-span-2 row-start-2 h-3 rounded-[3px] bg-slate-100 @xl:col-span-1 @xl:col-start-2 @xl:row-start-1" />
                  )}
                  <div className="col-start-2 row-start-1 flex flex-col items-end gap-0.5 text-right text-xs font-sans tabular-nums @xl:col-start-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 ${
                        over ? `border border-[#F3D19E] bg-[#FFF4DC] font-semibold ${TEXT_AMBER}` : "bg-slate-100 font-semibold text-slate-700"
                      }`}
                    >
                      {over && <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />}
                      {c.avgDays === null ? formatSampled(null, c.inReview, "days") : `${days(c.avgDays)} avg`}
                      {over && <span className="sr-only"> (over the {days(c.limitDays)} limit)</span>}
                    </span>
                    {c.overdue > 0 && (
                      <span className={`text-[11px] font-semibold ${TEXT_LOSS}`}>
                        {c.overdue} overdue
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="mt-auto pt-3">
            <DataTableToggle
              className="mt-0"
              caption="Client review waits"
              columns={["Client", "In review", "Average days", "Limit days", "Overdue"]}
              rows={clients.map((c) => ({
                key: String(c.clientId),
                cells: [c.clientName, c.inReview, c.avgDays === null ? "No data yet" : c.avgDays, c.limitDays, c.overdue],
              }))}
            />
          </div>
        </div>
      )}
    </AnalyticsPanel>
  );
};
