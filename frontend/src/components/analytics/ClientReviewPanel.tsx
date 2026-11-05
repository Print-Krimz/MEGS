import React from "react";
import { AlertTriangle } from "lucide-react";
import type { ClientReview } from "../../lib/types/analytics.types";
import { BAR_ON_TRACK, TEXT_AMBER, WORKLOAD } from "../../lib/chart-palette";
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

  return (
    <AnalyticsPanel
      tone="reports"
      id="client-review"
      title="Slowest client reviews"
      subtitle="Average days in client review vs each client's limit"
      className={`flex flex-col ${className ?? ""}`}
    >
      {clients.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-xs text-slate-600 font-sans">
          No candidates in client review.
        </div>
      ) : (
        <div className="flex flex-1 flex-col justify-between px-3.5 pb-3.5">
          <ol className="divide-y divide-slate-200">
            {clients.map((c, i) => {
              const over = c.avgDays !== null && c.avgDays > c.limitDays;
              return (
                <li key={c.clientId} className="py-2">
                  <div className="flex items-baseline justify-between gap-3 text-xs font-sans">
                    <span className="min-w-0 truncate font-semibold text-slate-900">
                      <span className="mr-1.5 tabular-nums text-slate-600">{i + 1}.</span>
                      {onSelectClient ? (
                        <button
                          type="button"
                          onClick={() => onSelectClient(c.clientId)}
                          className="text-left font-semibold text-navy underline underline-offset-2 decoration-slate-400 hover:decoration-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                        >
                          {c.clientName}
                        </button>
                      ) : (
                        c.clientName
                      )}
                    </span>
                    <span className={`flex shrink-0 items-center gap-1 tabular-nums ${over ? `font-semibold ${TEXT_AMBER}` : "text-slate-700"}`}>
                      {over && <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />}
                      {c.avgDays === null ? formatSampled(null, c.inReview, "days") : `${days(c.avgDays)} avg`}
                      {over && <span className="sr-only"> (over the {days(c.limitDays)} limit)</span>}
                    </span>
                  </div>
                  {c.avgDays !== null && (
                    <StackedBar
                      className="mt-1"
                      label={`${c.clientName}, average ${days(c.avgDays)}, limit ${days(c.limitDays)}`}
                      heightClass="h-2"
                      max={scale}
                      index={i}
                      segments={[
                        { key: "within", label: "within the limit", value: Math.min(c.avgDays, c.limitDays), color: BAR_ON_TRACK },
                        { key: "over", label: "past the limit", value: Math.max(0, c.avgDays - c.limitDays), color: WORKLOAD.overdue },
                      ]}
                    />
                  )}
                  <p className="mt-0.5 text-xs font-sans tabular-nums text-slate-600">
                    {c.inReview} in review · limit {days(c.limitDays)}
                    {c.overdue > 0 && ` · ${c.overdue} overdue`}
                  </p>
                </li>
              );
            })}
          </ol>
          <div className="mt-auto pt-2">
            <DataTableToggle
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
